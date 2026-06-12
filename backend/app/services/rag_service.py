"""
RAG Service - Retrieval Augmented Generation (Per-Session Stores)
Pipeline: File Upload → Text Extraction → Chunking → Embedding → FAISS Storage → Retrieval
Supports: PDF, TXT, MD, DOCX

Documents are scoped to individual chat sessions, so each session has its own
isolated FAISS index and chunk set.
"""

import os
import pickle
import shutil
import uuid
import threading
from typing import List, Tuple, Optional
import numpy as np

from app.config import settings

# Lazy imports for heavy ML libraries
_sentence_transformer = None
_faiss = None

def get_sentence_transformer():
    global _sentence_transformer
    if _sentence_transformer is None:
        from sentence_transformers import SentenceTransformer
        _sentence_transformer = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _sentence_transformer

def get_faiss():
    global _faiss
    if _faiss is None:
        import faiss
        _faiss = faiss
    return _faiss


class SessionVectorStore:
    """Manages FAISS index and chunks for a single chat session."""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.session_dir = os.path.join(settings.VECTORSTORE_DIR, session_id)
        os.makedirs(self.session_dir, exist_ok=True)
        
        self.index_path = os.path.join(self.session_dir, "faiss.index")
        self.chunks_path = os.path.join(self.session_dir, "chunks.pkl")
        self.index = None
        self.chunks: List[dict] = []
        self._load_existing()

    def _load_existing(self):
        faiss = get_faiss()
        if os.path.exists(self.index_path) and os.path.exists(self.chunks_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.chunks_path, "rb") as f:
                self.chunks = pickle.load(f)

    def _save(self):
        faiss = get_faiss()
        if self.index:
            faiss.write_index(self.index, self.index_path)
        with open(self.chunks_path, "wb") as f:
            pickle.dump(self.chunks, f)

    def add_document(self, new_chunks: List[dict]):
        if not new_chunks:
            return
            
        model = get_sentence_transformer()
        texts = [c["text"] for c in new_chunks]
        embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        embeddings = np.array(embeddings, dtype="float32")
        
        faiss = get_faiss()
        dim = embeddings.shape[1]
        
        if self.index is None:
            self.index = faiss.IndexFlatIP(dim)
        
        self.index.add(embeddings)
        self.chunks.extend(new_chunks)
        self._save()

    def delete_document(self, document_id: str) -> bool:
        """Removes a document's chunks from the FAISS index by rebuilding it."""
        initial_count = len(self.chunks)
        self.chunks = [c for c in self.chunks if c["document_id"] != document_id]
        
        if len(self.chunks) == initial_count:
            return False  # Document not found
            
        if not self.chunks:
            # Empty store
            self.index = None
            if os.path.exists(self.index_path):
                os.remove(self.index_path)
            self._save()
            return True
            
        # Rebuild FAISS index from remaining chunks
        model = get_sentence_transformer()
        texts = [c["text"] for c in self.chunks]
        embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        embeddings = np.array(embeddings, dtype="float32")
        
        faiss = get_faiss()
        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(embeddings)
        
        self._save()
        return True

    def destroy(self):
        """Remove the entire store directory from disk."""
        if os.path.exists(self.session_dir):
            shutil.rmtree(self.session_dir, ignore_errors=True)


class RAGService:
    def __init__(self):
        self._stores = {}
        self._lock = threading.Lock()

    def _get_store(self, session_id: str) -> SessionVectorStore:
        with self._lock:
            if session_id not in self._stores:
                self._stores[session_id] = SessionVectorStore(str(session_id))
            return self._stores[session_id]

    def _chunk_text(self, text: str, source: str, document_id: str) -> List[dict]:
        words = text.split()
        chunks = []
        step = settings.CHUNK_SIZE - settings.CHUNK_OVERLAP
        
        for i in range(0, len(words), step):
            chunk_words = words[i:i + settings.CHUNK_SIZE]
            chunk_text = " ".join(chunk_words)
            if len(chunk_text.strip()) > 50:
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "document_id": document_id,
                    "text": chunk_text,
                    "source": source,
                    "chunk_index": len(chunks)
                })
        return chunks
        
    def _extract_text(self, file_path: str, filename: str) -> str:
        ext = filename.lower().split('.')[-1]
        full_text = ""
        
        if ext == 'pdf':
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        full_text += page_text + "\n"
        elif ext in ['txt', 'md']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                full_text = f.read()
        elif ext == 'docx':
            import docx
            doc = docx.Document(file_path)
            full_text = "\n".join([p.text for p in doc.paragraphs])
            
        return full_text

    async def ingest_document(self, session_id: str, file_path: str, filename: str) -> dict:
        """Extract text, chunk, and ingest into the session's vector store."""
        full_text = self._extract_text(file_path, filename)
        
        if not full_text.strip():
            return {"error": "Could not extract text from document", "chunks": 0}
        
        document_id = str(uuid.uuid4())
        new_chunks = self._chunk_text(full_text, filename, document_id)
        
        store = self._get_store(session_id)
        store.add_document(new_chunks)
        
        return {
            "message": f"Ingested {filename}",
            "document_id": document_id,
            "chunks": len(new_chunks),
            "total_chunks": len(store.chunks)
        }

    def retrieve(self, session_id: str, query: str, top_k: int = None) -> Tuple[str, List[str]]:
        store = self._get_store(session_id)
        if not store.index or not store.chunks:
            return "", []
        
        top_k = top_k or settings.TOP_K_RESULTS
        model = get_sentence_transformer()
        
        query_vec = model.encode([query], normalize_embeddings=True)
        query_vec = np.array(query_vec, dtype="float32")
        
        scores, indices = store.index.search(query_vec, min(top_k, len(store.chunks)))
        
        retrieved = []
        sources = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and score > 0.3:  # Threshold
                chunk = store.chunks[idx]
                retrieved.append(f"[Source: {chunk['source']}]\n{chunk['text']}")
                sources.append(chunk["source"])
        
        context = "\n\n---\n\n".join(retrieved)
        return context, list(set(sources))

    def delete_document(self, session_id: str, document_id: str) -> bool:
        store = self._get_store(session_id)
        return store.delete_document(document_id)

    def delete_store(self, session_id: str):
        """Remove the entire vector store for a session (called on session delete)."""
        with self._lock:
            if session_id in self._stores:
                self._stores[session_id].destroy()
                del self._stores[session_id]
            else:
                # Not cached — clean up disk directly
                store_dir = os.path.join(settings.VECTORSTORE_DIR, str(session_id))
                if os.path.exists(store_dir):
                    shutil.rmtree(store_dir, ignore_errors=True)

    def list_documents(self, session_id: str) -> List[dict]:
        store = self._get_store(session_id)
        docs = {}
        for c in store.chunks:
            doc_id = c.get("document_id")
            if not doc_id: continue
            if doc_id not in docs:
                docs[doc_id] = {"id": doc_id, "name": c["source"], "chunks": 0}
            docs[doc_id]["chunks"] += 1
        return list(docs.values())

    def get_stats(self, session_id: str) -> dict:
        store = self._get_store(session_id)
        return {
            "total_chunks": len(store.chunks),
            "index_size": store.index.ntotal if store.index else 0,
            "documents": len(self.list_documents(session_id))
        }

rag_service = RAGService()

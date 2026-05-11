"""
RAG Service - Retrieval Augmented Generation
Pipeline: PDF Upload → Text Extraction → Chunking → Embedding → FAISS Storage → Retrieval
"""

import os
import pickle
import uuid
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


class RAGService:
    def __init__(self):
        self.index_path = os.path.join(settings.VECTORSTORE_DIR, "faiss.index")
        self.chunks_path = os.path.join(settings.VECTORSTORE_DIR, "chunks.pkl")
        self.index = None
        self.chunks: List[dict] = []
        self._load_existing()

    def _load_existing(self):
        """Load existing FAISS index and chunks from disk if available"""
        faiss = get_faiss()
        if os.path.exists(self.index_path) and os.path.exists(self.chunks_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.chunks_path, "rb") as f:
                self.chunks = pickle.load(f)

    def _save(self):
        """Persist FAISS index and chunk metadata to disk"""
        faiss = get_faiss()
        if self.index:
            faiss.write_index(self.index, self.index_path)
        with open(self.chunks_path, "wb") as f:
            pickle.dump(self.chunks, f)

    def _chunk_text(self, text: str, source: str) -> List[dict]:
        """
        TEXT CHUNKING - Split document into overlapping chunks for better retrieval
        Overlap ensures context isn't lost at chunk boundaries
        """
        words = text.split()
        chunks = []
        step = settings.CHUNK_SIZE - settings.CHUNK_OVERLAP
        
        for i in range(0, len(words), step):
            chunk_words = words[i:i + settings.CHUNK_SIZE]
            chunk_text = " ".join(chunk_words)
            if len(chunk_text.strip()) > 50:  # Skip tiny chunks
                chunks.append({
                    "id": str(uuid.uuid4()),
                    "text": chunk_text,
                    "source": source,
                    "chunk_index": len(chunks)
                })
        return chunks

    async def ingest_pdf(self, file_path: str, filename: str) -> dict:
        """
        RAG INGESTION PIPELINE:
        1. Extract text from PDF
        2. Split into chunks
        3. Generate embeddings via sentence-transformers
        4. Store in FAISS vector index
        """
        import pdfplumber
        
        # Step 1: Extract text
        full_text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"
        
        if not full_text.strip():
            return {"error": "Could not extract text from PDF", "chunks": 0}
        
        # Step 2: Chunk the text
        new_chunks = self._chunk_text(full_text, filename)
        
        # Step 3: Generate embeddings
        model = get_sentence_transformer()
        texts = [c["text"] for c in new_chunks]
        embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        embeddings = np.array(embeddings, dtype="float32")
        
        # Step 4: Add to FAISS index
        faiss = get_faiss()
        dim = embeddings.shape[1]
        
        if self.index is None:
            # Create new flat L2 index
            self.index = faiss.IndexFlatIP(dim)  # Inner product = cosine similarity (with normalized vectors)
        
        self.index.add(embeddings)
        self.chunks.extend(new_chunks)
        self._save()
        
        return {"message": f"Ingested {filename}", "chunks": len(new_chunks), "total_chunks": len(self.chunks)}

    def retrieve(self, query: str, top_k: int = None) -> Tuple[str, List[str]]:
        """
        RAG RETRIEVAL - Find most relevant chunks for a user query
        Returns formatted context string to inject into LLM prompt
        """
        if not self.index or not self.chunks:
            return "", []
        
        top_k = top_k or settings.TOP_K_RESULTS
        model = get_sentence_transformer()
        
        # Embed the query
        query_vec = model.encode([query], normalize_embeddings=True)
        query_vec = np.array(query_vec, dtype="float32")
        
        # Search FAISS index for nearest neighbors
        scores, indices = self.index.search(query_vec, min(top_k, len(self.chunks)))
        
        retrieved = []
        sources = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and score > 0.3:  # Threshold to filter irrelevant results
                chunk = self.chunks[idx]
                retrieved.append(f"[Source: {chunk['source']}]\n{chunk['text']}")
                sources.append(chunk["source"])
        
        context = "\n\n---\n\n".join(retrieved)
        return context, list(set(sources))

    def get_stats(self) -> dict:
        return {
            "total_chunks": len(self.chunks),
            "index_size": self.index.ntotal if self.index else 0,
            "sources": list(set(c["source"] for c in self.chunks))
        }

rag_service = RAGService()

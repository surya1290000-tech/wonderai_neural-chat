import { useState, useCallback } from 'react'

/**
 * Custom hook for managing notification toasts
 */
export function useNotification() {
    const [notification, setNotification] = useState(null)

    const showNotif = useCallback((msg, type = 'success') => {
        setNotification({ msg, type })
        setTimeout(() => setNotification(null), 3000)
    }, [])

    const clearNotif = useCallback(() => {
        setNotification(null)
    }, [])

    return { notification, showNotif, clearNotif }
}

/**
 * Custom hook for keyboard shortcuts
 */
export function useKeyboardShortcut(key, callback, { ctrlKey = false, metaKey = false } = {}) {
    const handleKeyDown = useCallback((e) => {
        const modifierMatch = ctrlKey ? (e.ctrlKey || e.metaKey) : metaKey ? e.metaKey : true
        if (e.key === key && modifierMatch) {
            e.preventDefault()
            callback(e)
        }
    }, [key, callback, ctrlKey, metaKey])

    return handleKeyDown
}

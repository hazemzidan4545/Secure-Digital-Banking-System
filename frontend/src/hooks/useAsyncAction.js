import { useCallback, useState } from 'react'

export function useAsyncAction() {
  const [loadingKey, setLoadingKey] = useState('')

  const run = useCallback(async (key, fn) => {
    setLoadingKey(key)
    try {
      return await fn()
    } finally {
      setLoadingKey('')
    }
  }, [])

  return { loadingKey, run }
}

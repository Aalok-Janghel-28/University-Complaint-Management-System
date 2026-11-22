import { useEffect, useMemo, useState } from 'react'

import { authApi, tokenStorage } from '../api/authApi'
import AuthContext from './authContext'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      if (!tokenStorage.getAccessToken()) {
        try {
          const { data } = await authApi.refreshSession()
          tokenStorage.setTokens(data)
        } catch {
          tokenStorage.clear()
          setIsLoading(false)
          return
        }
      }

      try {
        const { data } = await authApi.getProfile()
        setUser(data)
      } catch {
        tokenStorage.clear()
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [])

  const register = async (payload) => {
    const { data } = await authApi.register(payload)
    tokenStorage.setTokens(data)
    setUser(data.user)
    return data
  }

  const login = async (payload) => {
    const { data } = await authApi.login(payload)
    tokenStorage.setTokens(data)
    setUser(data.user)
    return data
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } finally {
      tokenStorage.clear()
      setUser(null)
    }
  }

  const refreshProfile = async () => {
    const { data } = await authApi.getProfile()
    setUser(data)
    return data
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      register,
      login,
      logout,
      refreshProfile,
    }),
    [user, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

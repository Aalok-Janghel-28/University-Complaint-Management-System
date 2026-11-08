import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { authApi, tokenStorage } from '../api/authApi'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      if (!tokenStorage.getAccessToken()) {
        setIsLoading(false)
        return
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
    const refresh = tokenStorage.getRefreshToken()
    try {
      if (refresh) {
        await authApi.logout(refresh)
      }
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

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }
  return context
}

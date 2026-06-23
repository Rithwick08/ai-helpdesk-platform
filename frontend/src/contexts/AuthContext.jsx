import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token')
    const storedUser = localStorage.getItem('current_user')
    
    if (storedToken && storedUser) {
      setToken(storedToken)
      setCurrentUser(JSON.parse(storedUser))
      // Configure default axios header
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
    }
    
    setLoading(false)
  }, [])

  // Login handler
  const login = async (email, password) => {
    try {
      // existing backend expects credentials
      const response = await axios.post('http://localhost:8000/auth/login', {
        email,
        password,
      })
      
      const { access_token, user } = response.data
      
      // Save state
      setToken(access_token)
      setCurrentUser(user)
      
      // Persist in localStorage
      localStorage.setItem('access_token', access_token)
      localStorage.setItem('current_user', JSON.stringify(user))
      
      // Set default header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
      
      return { success: true, user }
    } catch (error) {
      console.error('Login failed:', error)
      return { 
        success: false, 
        message: error.response?.data?.detail || 'An error occurred during login.' 
      }
    }
  }

  // Logout handler
  const logout = () => {
    setToken(null)
    setCurrentUser(null)
    localStorage.removeItem('access_token')
    localStorage.removeItem('current_user')
    delete axios.defaults.headers.common['Authorization']
  }

  const value = {
    currentUser,
    role: currentUser?.role,
    token,
    isAuthenticated: !!token,
    login,
    logout,
  }

  // Prevent flashing protected routes before checking localStorage
  if (loading) {
    return null 
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

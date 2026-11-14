import React, { createContext, useContext, useState, useEffect } from 'react';
import { tokenStorage } from '../services/storage';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and check auto-login on startup
  useEffect(() => {
    checkAuthSession();
  }, []);

  const checkAuthSession = async () => {
    try {
      setIsLoading(true);
      const storedToken = await tokenStorage.getToken();
      const storedUser = await tokenStorage.getUser();

      if (storedToken) {
        setToken(storedToken);

        // Pre-populate with cached user for immediate UI responsiveness
        if (storedUser) {
          setUser(storedUser);
        }

        // Validate token against backend
        try {
          const res = await authService.getMe();
          if (res?.data?.user) {
            setUser(res.data.user);
            await tokenStorage.setUser(res.data.user);
          }
        } catch (apiError) {
          console.warn('Token validation with backend failed:', apiError.message);
          // If token is invalid or expired (401), clean up
          if (apiError.status === 401) {
            await tokenStorage.clearAll();
            setUser(null);
            setToken(null);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to restore authentication session:', e);
      await tokenStorage.clearAll();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const res = await authService.login(email, password);
      const { token: receivedToken, user: receivedUser } = res.data;

      await tokenStorage.setToken(receivedToken);
      await tokenStorage.setUser(receivedUser);

      setToken(receivedToken);
      setUser(receivedUser);

      return { success: true, user: receivedUser };
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name, email, password, confirmPassword) => {
    setIsLoading(true);
    try {
      const res = await authService.register(name, email, password, confirmPassword);
      const { token: receivedToken, user: receivedUser } = res.data;

      await tokenStorage.setToken(receivedToken);
      await tokenStorage.setUser(receivedUser);

      setToken(receivedToken);
      setUser(receivedUser);

      return { success: true, user: receivedUser };
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await tokenStorage.clearAll();
    } catch (e) {
      console.warn('Error clearing storage on logout', e);
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authService.getMe();
      if (res?.data?.user) {
        setUser(res.data.user);
        await tokenStorage.setUser(res.data.user);
      }
    } catch (e) {
      console.warn('Failed to refresh user data', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user && !!token,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        refreshUser,
        checkAuthSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

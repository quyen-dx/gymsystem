import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './context/AuthProvider.tsx';
import { CartProvider } from './context/CartProvider';
import { WalletProvider } from './context/WalletProvider.tsx';
import './index.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <WalletProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </WalletProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
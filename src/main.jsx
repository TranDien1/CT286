import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppProvider';
import './index.css';
import './app.css';

// Bản đăng web (VITE_ARTIFACT=1) dùng MemoryRouter vì không có máy chủ xử lý đường dẫn.
const Router = import.meta.env.VITE_ARTIFACT ? MemoryRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <AppProvider>
        <App />
      </AppProvider>
    </Router>
  </React.StrictMode>
);

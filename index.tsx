
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AiConfigProvider } from './context/AiConfigContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AiConfigProvider>
      <App />
    </AiConfigProvider>
  </React.StrictMode>
);

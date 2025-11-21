import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// 导入 CSS，以加载 Tailwind 样式
import '../index.css'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import { createRoot } from 'react-dom/client';

import App from './pages/App.js';

const root = document.getElementById('root');
if (root === null) {
  throw new Error('Browser root element #root was not found');
}

createRoot(root).render(<App />);

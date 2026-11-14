import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConversationPage } from './conversation/conversation-page';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html has no #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <ConversationPage />
  </StrictMode>,
);

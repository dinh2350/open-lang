import { Room } from 'livekit-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app';
import { loadFrontendConfig } from './config';
import './index.css';

const { agentJoinTimeoutMilliseconds } = loadFrontendConfig({
  VITE_AGENT_JOIN_TIMEOUT_MS: import.meta.env.VITE_AGENT_JOIN_TIMEOUT_MS,
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html has no #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App
        room={new Room()}
        agentJoinTimeoutMilliseconds={agentJoinTimeoutMilliseconds}
      />
    </BrowserRouter>
  </StrictMode>,
);

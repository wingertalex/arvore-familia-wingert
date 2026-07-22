import React from 'react'
import ReactDOM from 'react-dom/client'
import {ReactFlowProvider} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './viewer-flow.css'
import ViewerFlow from './ViewerFlow'

ReactDOM.createRoot(document.getElementById('viewer-root')!).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <ViewerFlow />
    </ReactFlowProvider>
  </React.StrictMode>,
)

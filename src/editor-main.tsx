import React from 'react'
import ReactDOM from 'react-dom/client'
import {ReactFlowProvider} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './editor-flow.css'
import EditorFlow from './EditorFlow'

ReactDOM.createRoot(document.getElementById('editor-root')!).render(
  <React.StrictMode>
    <ReactFlowProvider>
      <EditorFlow />
    </ReactFlowProvider>
  </React.StrictMode>,
)
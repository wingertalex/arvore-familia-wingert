import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './AppSexo'
import './styles.css'

const visualizandoArvore = new URLSearchParams(window.location.search).get('view') === 'tree'

if (visualizandoArvore) {
  window.location.replace('/arvore.html')
} else {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

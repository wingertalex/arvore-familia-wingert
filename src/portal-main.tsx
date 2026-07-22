import React from 'react'
import ReactDOM from 'react-dom/client'
import './portal.css'

const links = [
  {href: '/arvore-desenhada.html', label: 'Ver árvore desenhada', description: 'Visualize o desenho completo da família exatamente como foi organizado no editor.'},
  {href: '/arvore-publica.html', label: 'Consultar pessoas', description: 'Pesquise nomes, datas e vínculos familiares em uma lista pública.'},
  {href: '/cadastro.html', label: 'Cadastrar pessoas', description: 'Área reservada para cadastrar e atualizar informações da família.'},
]

function PortalHome() {
  return (
    <div className="portal-shell">
      <header className="portal-header">
        <a className="brand" href="/" aria-label="Página inicial do Projeto Raízes Wingert">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span>
            <strong>Raízes Wingert</strong>
            <small>Memória, história e família</small>
          </span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#inicio">Início</a>
          <a href="/arvore-desenhada.html">Árvore</a>
          <a href="#historia">Sobre</a>
          <a className="nav-cta" href="/cadastro.html">Cadastro</a>
        </nav>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="hero-copy">
            <span className="eyebrow">Projeto Raízes Wingert</span>
            <h1>Preservando a história da família para as próximas gerações.</h1>
            <p>
              Um espaço criado para reunir nomes, vínculos, datas e memórias que ajudam a contar de onde viemos.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="/arvore-desenhada.html">Ver árvore desenhada</a>
              <a className="button secondary" href="/arvore-publica.html">Consultar pessoas</a>
            </div>
          </div>

          <div className="hero-card" aria-label="Resumo do projeto">
            <div className="tree-symbol" aria-hidden="true">
              <span className="leaf leaf-one" />
              <span className="leaf leaf-two" />
              <span className="leaf leaf-three" />
              <span className="trunk" />
            </div>
            <p>Uma história construída pessoa por pessoa, geração após geração.</p>
          </div>
        </section>

        <section className="quick-links" aria-label="Acessos principais">
          {links.map((item) => (
            <a className="feature-card" href={item.href} key={item.label}>
              <span className="feature-arrow" aria-hidden="true">↗</span>
              <h2>{item.label}</h2>
              <p>{item.description}</p>
            </a>
          ))}
        </section>

        <section className="story" id="historia">
          <div>
            <span className="eyebrow">Nosso propósito</span>
            <h2>Mais do que uma árvore genealógica.</h2>
          </div>
          <p>
            O Projeto Raízes Wingert foi pensado como um arquivo vivo da família. A proposta é organizar informações,
            registrar descobertas e facilitar o acesso das próximas gerações à própria história.
          </p>
        </section>
      </main>

      <footer>
        <span>Projeto Raízes Wingert</span>
        <span>Preservando histórias em família.</span>
      </footer>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('portal-root')!).render(
  <React.StrictMode>
    <PortalHome />
  </React.StrictMode>,
)

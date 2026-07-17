import {FormEvent, useEffect, useState} from 'react'
import {onAuthStateChanged, signInWithEmailAndPassword, signOut, User} from 'firebase/auth'
import {addDoc, collection, onSnapshot, orderBy, query, serverTimestamp} from 'firebase/firestore'
import {auth, db} from './firebase'

type Pessoa = {
  id: string
  nome: string
  sobrenome: string
  nascimento?: string
  falecimento?: string
  viva: boolean
}

export default function App() {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [pessoas, setPessoas] = useState<Pessoa[]>([])

  useEffect(() => onAuthStateChanged(auth, user => {
    setUsuario(user)
    setCarregando(false)
  }), [])

  useEffect(() => {
    if (!usuario) {
      setPessoas([])
      return
    }

    const consulta = query(collection(db, 'pessoas'), orderBy('nome'))
    return onSnapshot(consulta, snapshot => {
      setPessoas(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Pessoa)))
    })
  }, [usuario])

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    const dados = new FormData(event.currentTarget)

    try {
      await signInWithEmailAndPassword(
        auth,
        String(dados.get('email')),
        String(dados.get('senha')),
      )
    } catch {
      setErro('Não foi possível entrar. Confira o e-mail e a senha.')
    }
  }

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    const formulario = event.currentTarget
    const dados = new FormData(formulario)

    try {
      await addDoc(collection(db, 'pessoas'), {
        nome: String(dados.get('nome')).trim(),
        sobrenome: String(dados.get('sobrenome')).trim(),
        nascimento: String(dados.get('nascimento') || ''),
        falecimento: String(dados.get('falecimento') || ''),
        viva: dados.get('viva') === 'on',
        criadoPor: usuario?.uid,
        criadoEm: serverTimestamp(),
      })
      formulario.reset()
    } catch {
      setErro('Não foi possível salvar. Confira as regras do Firestore.')
    }
  }

  if (carregando) return <main className="centralizado">Carregando…</main>

  if (!usuario) {
    return (
      <main className="login-page">
        <section className="login-card">
          <span className="marca">Família Wingert</span>
          <h1>Nossa história, preservada em família.</h1>
          <p>Entre para consultar e construir a árvore genealógica.</p>
          <form onSubmit={entrar}>
            <label>E-mail<input name="email" type="email" required /></label>
            <label>Senha<input name="senha" type="password" required /></label>
            {erro && <p className="erro">{erro}</p>}
            <button type="submit">Entrar</button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main>
      <header>
        <div><span className="marca">Família Wingert</span><h1>Árvore genealógica</h1></div>
        <button className="secundario" onClick={() => signOut(auth)}>Sair</button>
      </header>

      <div className="conteudo">
        <section className="painel">
          <h2>Cadastrar pessoa</h2>
          <form className="grade" onSubmit={cadastrar}>
            <label>Nome<input name="nome" required /></label>
            <label>Sobrenome<input name="sobrenome" required /></label>
            <label>Nascimento<input name="nascimento" type="date" /></label>
            <label>Falecimento<input name="falecimento" type="date" /></label>
            <label className="checkbox"><input name="viva" type="checkbox" defaultChecked /> Pessoa viva</label>
            <button type="submit">Salvar pessoa</button>
          </form>
          {erro && <p className="erro">{erro}</p>}
        </section>

        <section className="painel">
          <div className="titulo-lista"><h2>Pessoas cadastradas</h2><span>{pessoas.length}</span></div>
          {pessoas.length === 0 ? <p>Nenhuma pessoa cadastrada ainda.</p> : (
            <div className="lista">
              {pessoas.map(pessoa => (
                <article key={pessoa.id}>
                  <strong>{pessoa.nome} {pessoa.sobrenome}</strong>
                  <span>{pessoa.nascimento || 'Nascimento não informado'}{!pessoa.viva && pessoa.falecimento ? ` — ${pessoa.falecimento}` : ''}</span>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

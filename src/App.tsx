import {FormEvent, useEffect, useState} from 'react'
import {onAuthStateChanged, signInWithEmailAndPassword, signOut, User} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import {auth, db} from './firebase'

type Pessoa = {
  id: string
  nome: string
  sobrenome: string
  nascimento?: string
  falecimento?: string
  viva: boolean
}

type FormularioPessoa = {
  nome: string
  sobrenome: string
  nascimento: string
  falecimento: string
  viva: boolean
}

const formularioInicial: FormularioPessoa = {
  nome: '',
  sobrenome: '',
  nascimento: '',
  falecimento: '',
  viva: true,
}

export default function App() {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [pessoaEmEdicao, setPessoaEmEdicao] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<FormularioPessoa>(formularioInicial)

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
    return onSnapshot(
      consulta,
      snapshot => {
        setPessoas(snapshot.docs.map(documento => ({id: documento.id, ...documento.data()} as Pessoa)))
      },
      () => setErro('Não foi possível carregar as pessoas cadastradas.'),
    )
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

  function limparFormulario() {
    setFormulario(formularioInicial)
    setPessoaEmEdicao(null)
    setErro('')
  }

  function editarPessoa(pessoa: Pessoa) {
    setPessoaEmEdicao(pessoa.id)
    setFormulario({
      nome: pessoa.nome,
      sobrenome: pessoa.sobrenome,
      nascimento: pessoa.nascimento || '',
      falecimento: pessoa.falecimento || '',
      viva: pessoa.viva,
    })
    setErro('')
    window.scrollTo({top: 0, behavior: 'smooth'})
  }

  async function salvarPessoa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    setSalvando(true)

    const dadosPessoa = {
      nome: formulario.nome.trim(),
      sobrenome: formulario.sobrenome.trim(),
      nascimento: formulario.nascimento,
      falecimento: formulario.viva ? '' : formulario.falecimento,
      viva: formulario.viva,
      atualizadoPor: usuario?.uid,
      atualizadoEm: serverTimestamp(),
    }

    try {
      if (pessoaEmEdicao) {
        await updateDoc(doc(db, 'pessoas', pessoaEmEdicao), dadosPessoa)
      } else {
        await addDoc(collection(db, 'pessoas'), {
          ...dadosPessoa,
          criadoPor: usuario?.uid,
          criadoEm: serverTimestamp(),
        })
      }
      limparFormulario()
    } catch {
      setErro('Não foi possível salvar. Confira as regras do Firestore.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirPessoa(pessoa: Pessoa) {
    const confirmou = window.confirm(
      `Deseja realmente excluir ${pessoa.nome} ${pessoa.sobrenome}? Esta ação não poderá ser desfeita.`,
    )

    if (!confirmou) return

    setErro('')
    try {
      await deleteDoc(doc(db, 'pessoas', pessoa.id))
      if (pessoaEmEdicao === pessoa.id) limparFormulario()
    } catch {
      setErro('Não foi possível excluir esta pessoa.')
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
          <h2>{pessoaEmEdicao ? 'Editar pessoa' : 'Cadastrar pessoa'}</h2>
          <form className="grade" onSubmit={salvarPessoa}>
            <label>
              Nome
              <input
                value={formulario.nome}
                onChange={event => setFormulario({...formulario, nome: event.target.value})}
                required
              />
            </label>
            <label>
              Sobrenome
              <input
                value={formulario.sobrenome}
                onChange={event => setFormulario({...formulario, sobrenome: event.target.value})}
                required
              />
            </label>
            <label>
              Nascimento
              <input
                type="date"
                value={formulario.nascimento}
                onChange={event => setFormulario({...formulario, nascimento: event.target.value})}
              />
            </label>
            <label>
              Falecimento
              <input
                type="date"
                value={formulario.falecimento}
                disabled={formulario.viva}
                onChange={event => setFormulario({...formulario, falecimento: event.target.value})}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={formulario.viva}
                onChange={event => setFormulario({
                  ...formulario,
                  viva: event.target.checked,
                  falecimento: event.target.checked ? '' : formulario.falecimento,
                })}
              />
              Pessoa viva
            </label>
            <div className="acoes-formulario">
              {pessoaEmEdicao && (
                <button type="button" className="botao-neutro" onClick={limparFormulario}>
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={salvando}>
                {salvando ? 'Salvando…' : pessoaEmEdicao ? 'Salvar alterações' : 'Salvar pessoa'}
              </button>
            </div>
          </form>
          {erro && <p className="erro">{erro}</p>}
        </section>

        <section className="painel">
          <div className="titulo-lista"><h2>Pessoas cadastradas</h2><span>{pessoas.length}</span></div>
          {pessoas.length === 0 ? <p>Nenhuma pessoa cadastrada ainda.</p> : (
            <div className="lista">
              {pessoas.map(pessoa => (
                <article key={pessoa.id}>
                  <div className="dados-pessoa">
                    <strong>{pessoa.nome} {pessoa.sobrenome}</strong>
                    <span>
                      {pessoa.nascimento || 'Nascimento não informado'}
                      {!pessoa.viva && pessoa.falecimento ? ` — ${pessoa.falecimento}` : ''}
                    </span>
                  </div>
                  <div className="acoes-pessoa">
                    <button type="button" className="botao-editar" onClick={() => editarPessoa(pessoa)}>
                      Editar
                    </button>
                    <button type="button" className="botao-excluir" onClick={() => excluirPessoa(pessoa)}>
                      Excluir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

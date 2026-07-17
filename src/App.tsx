import {FormEvent, useEffect, useMemo, useState} from 'react'
import {onAuthStateChanged, signInWithEmailAndPassword, signOut, User} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import {auth, db} from './firebase'

type Pessoa = {
  id: string
  nome: string
  sobrenome: string
  nascimento?: string
  falecimento?: string
  viva: boolean
  cidade?: string
  bairro?: string
  paiId?: string
  maeId?: string
  casada?: boolean
  conjugeId?: string
}

type CadastroRapido = {
  ativo: boolean
  nome: string
  sobrenome: string
  viva: boolean
}

type FormularioPessoa = {
  nome: string
  sobrenome: string
  nascimento: string
  falecimento: string
  viva: boolean
  cidade: string
  bairro: string
  paiId: string
  maeId: string
  casada: boolean
  conjugeId: string
  novoPai: CadastroRapido
  novaMae: CadastroRapido
}

const cadastroRapidoInicial: CadastroRapido = {
  ativo: false,
  nome: '',
  sobrenome: '',
  viva: true,
}

const formularioInicial: FormularioPessoa = {
  nome: '',
  sobrenome: '',
  nascimento: '',
  falecimento: '',
  viva: true,
  cidade: '',
  bairro: '',
  paiId: '',
  maeId: '',
  casada: false,
  conjugeId: '',
  novoPai: {...cadastroRapidoInicial},
  novaMae: {...cadastroRapidoInicial},
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

  const pessoasDisponiveis = useMemo(
    () => pessoas.filter(pessoa => pessoa.id !== pessoaEmEdicao),
    [pessoas, pessoaEmEdicao],
  )

  function nomeCompletoPorId(id?: string) {
    if (!id) return ''
    const pessoa = pessoas.find(item => item.id === id)
    return pessoa ? `${pessoa.nome} ${pessoa.sobrenome}` : 'Pessoa não encontrada'
  }

  function filhosDe(pessoaId: string) {
    return pessoas.filter(pessoa => pessoa.paiId === pessoaId || pessoa.maeId === pessoaId)
  }

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
    setFormulario({...formularioInicial, novoPai: {...cadastroRapidoInicial}, novaMae: {...cadastroRapidoInicial}})
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
      cidade: pessoa.cidade || '',
      bairro: pessoa.bairro || '',
      paiId: pessoa.paiId || '',
      maeId: pessoa.maeId || '',
      casada: Boolean(pessoa.casada),
      conjugeId: pessoa.conjugeId || '',
      novoPai: {...cadastroRapidoInicial},
      novaMae: {...cadastroRapidoInicial},
    })
    setErro('')
    window.scrollTo({top: 0, behavior: 'smooth'})
  }

  function validarFormulario() {
    if (formulario.paiId && formulario.paiId === formulario.maeId) {
      return 'Pai e mãe não podem ser a mesma pessoa.'
    }

    if (formulario.casada && !formulario.conjugeId) {
      return 'Selecione o cônjuge ou desmarque a opção “Pessoa casada”.'
    }

    if (formulario.conjugeId && [formulario.paiId, formulario.maeId].includes(formulario.conjugeId)) {
      return 'O cônjuge não pode ser a mesma pessoa cadastrada como pai ou mãe.'
    }

    if (formulario.novoPai.ativo && (!formulario.novoPai.nome.trim() || !formulario.novoPai.sobrenome.trim())) {
      return 'Informe nome e sobrenome do novo pai.'
    }

    if (formulario.novaMae.ativo && (!formulario.novaMae.nome.trim() || !formulario.novaMae.sobrenome.trim())) {
      return 'Informe nome e sobrenome da nova mãe.'
    }

    return ''
  }

  async function salvarPessoa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')

    const mensagemValidacao = validarFormulario()
    if (mensagemValidacao) {
      setErro(mensagemValidacao)
      return
    }

    setSalvando(true)

    try {
      const batch = writeBatch(db)
      let paiId = formulario.paiId
      let maeId = formulario.maeId

      if (formulario.novoPai.ativo) {
        const referenciaPai = doc(collection(db, 'pessoas'))
        paiId = referenciaPai.id
        batch.set(referenciaPai, {
          nome: formulario.novoPai.nome.trim(),
          sobrenome: formulario.novoPai.sobrenome.trim(),
          nascimento: '',
          falecimento: '',
          viva: formulario.novoPai.viva,
          cidade: '',
          bairro: '',
          paiId: '',
          maeId: '',
          casada: false,
          conjugeId: '',
          criadoPor: usuario?.uid,
          criadoEm: serverTimestamp(),
          atualizadoPor: usuario?.uid,
          atualizadoEm: serverTimestamp(),
        })
      }

      if (formulario.novaMae.ativo) {
        const referenciaMae = doc(collection(db, 'pessoas'))
        maeId = referenciaMae.id
        batch.set(referenciaMae, {
          nome: formulario.novaMae.nome.trim(),
          sobrenome: formulario.novaMae.sobrenome.trim(),
          nascimento: '',
          falecimento: '',
          viva: formulario.novaMae.viva,
          cidade: '',
          bairro: '',
          paiId: '',
          maeId: '',
          casada: false,
          conjugeId: '',
          criadoPor: usuario?.uid,
          criadoEm: serverTimestamp(),
          atualizadoPor: usuario?.uid,
          atualizadoEm: serverTimestamp(),
        })
      }

      const referenciaPessoa = pessoaEmEdicao
        ? doc(db, 'pessoas', pessoaEmEdicao)
        : doc(collection(db, 'pessoas'))

      const pessoaAnterior = pessoaEmEdicao ? pessoas.find(pessoa => pessoa.id === pessoaEmEdicao) : undefined
      const conjugeAnteriorId = pessoaAnterior?.conjugeId || ''
      const novoConjugeId = formulario.casada ? formulario.conjugeId : ''

      const dadosPessoa = {
        nome: formulario.nome.trim(),
        sobrenome: formulario.sobrenome.trim(),
        nascimento: formulario.nascimento,
        falecimento: formulario.viva ? '' : formulario.falecimento,
        viva: formulario.viva,
        cidade: formulario.cidade.trim(),
        bairro: formulario.bairro.trim(),
        paiId,
        maeId,
        casada: formulario.casada,
        conjugeId: novoConjugeId,
        atualizadoPor: usuario?.uid,
        atualizadoEm: serverTimestamp(),
      }

      if (pessoaEmEdicao) {
        batch.update(referenciaPessoa, dadosPessoa)
      } else {
        batch.set(referenciaPessoa, {
          ...dadosPessoa,
          criadoPor: usuario?.uid,
          criadoEm: serverTimestamp(),
        })
      }

      if (conjugeAnteriorId && conjugeAnteriorId !== novoConjugeId) {
        batch.update(doc(db, 'pessoas', conjugeAnteriorId), {
          casada: false,
          conjugeId: '',
          atualizadoPor: usuario?.uid,
          atualizadoEm: serverTimestamp(),
        })
      }

      if (novoConjugeId) {
        const conjugeSelecionado = pessoas.find(pessoa => pessoa.id === novoConjugeId)
        if (conjugeSelecionado?.conjugeId && conjugeSelecionado.conjugeId !== referenciaPessoa.id) {
          throw new Error('Cônjuge já vinculado')
        }

        batch.update(doc(db, 'pessoas', novoConjugeId), {
          casada: true,
          conjugeId: referenciaPessoa.id,
          atualizadoPor: usuario?.uid,
          atualizadoEm: serverTimestamp(),
        })
      }

      await batch.commit()
      limparFormulario()
    } catch (error) {
      const mensagem = error instanceof Error && error.message === 'Cônjuge já vinculado'
        ? 'A pessoa selecionada já possui outro cônjuge vinculado.'
        : 'Não foi possível salvar. Confira os vínculos e as regras do Firestore.'
      setErro(mensagem)
    } finally {
      setSalvando(false)
    }
  }

  async function excluirPessoa(pessoa: Pessoa) {
    const filhos = filhosDe(pessoa.id)
    if (filhos.length > 0) {
      setErro(
        `${pessoa.nome} ${pessoa.sobrenome} possui ${filhos.length} vínculo(s) como pai ou mãe. Remova esses vínculos antes de excluir.`,
      )
      return
    }

    if (pessoa.conjugeId) {
      setErro(`Remova primeiro o vínculo conjugal de ${pessoa.nome} ${pessoa.sobrenome}.`)
      return
    }

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
            <label>Nome<input value={formulario.nome} onChange={event => setFormulario({...formulario, nome: event.target.value})} required /></label>
            <label>Sobrenome<input value={formulario.sobrenome} onChange={event => setFormulario({...formulario, sobrenome: event.target.value})} required /></label>
            <label>Nascimento<input type="date" value={formulario.nascimento} onChange={event => setFormulario({...formulario, nascimento: event.target.value})} /></label>
            <label>Falecimento<input type="date" value={formulario.falecimento} disabled={formulario.viva} onChange={event => setFormulario({...formulario, falecimento: event.target.value})} /></label>
            <label>Cidade (opcional)<input value={formulario.cidade} onChange={event => setFormulario({...formulario, cidade: event.target.value})} placeholder="Ex.: Dois Irmãos" /></label>
            <label>Bairro (opcional)<input value={formulario.bairro} onChange={event => setFormulario({...formulario, bairro: event.target.value})} placeholder="Ex.: Centro" /></label>

            <fieldset className="grupo-vinculo">
              <legend>Pai</legend>
              <label>
                Selecionar pessoa cadastrada
                <select value={formulario.paiId} disabled={formulario.novoPai.ativo} onChange={event => setFormulario({...formulario, paiId: event.target.value})}>
                  <option value="">Não informado</option>
                  {pessoasDisponiveis.map(pessoa => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome} {pessoa.sobrenome}</option>)}
                </select>
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={formulario.novoPai.ativo} onChange={event => setFormulario({...formulario, paiId: '', novoPai: {...formulario.novoPai, ativo: event.target.checked}})} />
                Cadastrar um novo pai agora
              </label>
              {formulario.novoPai.ativo && (
                <div className="cadastro-rapido">
                  <label>Nome do pai<input value={formulario.novoPai.nome} onChange={event => setFormulario({...formulario, novoPai: {...formulario.novoPai, nome: event.target.value}})} required /></label>
                  <label>Sobrenome do pai<input value={formulario.novoPai.sobrenome} onChange={event => setFormulario({...formulario, novoPai: {...formulario.novoPai, sobrenome: event.target.value}})} required /></label>
                  <label className="checkbox"><input type="checkbox" checked={formulario.novoPai.viva} onChange={event => setFormulario({...formulario, novoPai: {...formulario.novoPai, viva: event.target.checked}})} /> Pessoa viva</label>
                </div>
              )}
            </fieldset>

            <fieldset className="grupo-vinculo">
              <legend>Mãe</legend>
              <label>
                Selecionar pessoa cadastrada
                <select value={formulario.maeId} disabled={formulario.novaMae.ativo} onChange={event => setFormulario({...formulario, maeId: event.target.value})}>
                  <option value="">Não informada</option>
                  {pessoasDisponiveis.map(pessoa => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome} {pessoa.sobrenome}</option>)}
                </select>
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={formulario.novaMae.ativo} onChange={event => setFormulario({...formulario, maeId: '', novaMae: {...formulario.novaMae, ativo: event.target.checked}})} />
                Cadastrar uma nova mãe agora
              </label>
              {formulario.novaMae.ativo && (
                <div className="cadastro-rapido">
                  <label>Nome da mãe<input value={formulario.novaMae.nome} onChange={event => setFormulario({...formulario, novaMae: {...formulario.novaMae, nome: event.target.value}})} required /></label>
                  <label>Sobrenome da mãe<input value={formulario.novaMae.sobrenome} onChange={event => setFormulario({...formulario, novaMae: {...formulario.novaMae, sobrenome: event.target.value}})} required /></label>
                  <label className="checkbox"><input type="checkbox" checked={formulario.novaMae.viva} onChange={event => setFormulario({...formulario, novaMae: {...formulario.novaMae, viva: event.target.checked}})} /> Pessoa viva</label>
                </div>
              )}
            </fieldset>

            <label className="checkbox"><input type="checkbox" checked={formulario.viva} onChange={event => setFormulario({...formulario, viva: event.target.checked, falecimento: event.target.checked ? '' : formulario.falecimento})} /> Pessoa viva</label>
            <label className="checkbox"><input type="checkbox" checked={formulario.casada} onChange={event => setFormulario({...formulario, casada: event.target.checked, conjugeId: event.target.checked ? formulario.conjugeId : ''})} /> Pessoa casada</label>

            {formulario.casada && (
              <label className="campo-largo">
                Cônjuge
                <select value={formulario.conjugeId} onChange={event => setFormulario({...formulario, conjugeId: event.target.value})} required>
                  <option value="">Selecione o cônjuge</option>
                  {pessoasDisponiveis.map(pessoa => <option key={pessoa.id} value={pessoa.id}>{pessoa.nome} {pessoa.sobrenome}</option>)}
                </select>
              </label>
            )}

            <div className="acoes-formulario">
              {pessoaEmEdicao && <button type="button" className="botao-neutro" onClick={limparFormulario}>Cancelar</button>}
              <button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : pessoaEmEdicao ? 'Salvar alterações' : 'Salvar pessoa'}</button>
            </div>
          </form>
          {erro && <p className="erro">{erro}</p>}
        </section>

        <section className="painel">
          <div className="titulo-lista"><h2>Pessoas cadastradas</h2><span>{pessoas.length}</span></div>
          {pessoas.length === 0 ? <p>Nenhuma pessoa cadastrada ainda.</p> : (
            <div className="lista">
              {pessoas.map(pessoa => {
                const filhos = filhosDe(pessoa.id)
                const local = [pessoa.bairro, pessoa.cidade].filter(Boolean).join(', ')

                return (
                  <article key={pessoa.id}>
                    <div className="dados-pessoa">
                      <strong>{pessoa.nome} {pessoa.sobrenome}</strong>
                      <span>{pessoa.nascimento || 'Nascimento não informado'}{!pessoa.viva && pessoa.falecimento ? ` — ${pessoa.falecimento}` : ''}</span>
                      {local && <span>Local: {local}</span>}
                      {(pessoa.paiId || pessoa.maeId) && <span>Pais: {pessoa.paiId ? nomeCompletoPorId(pessoa.paiId) : 'não informado'} / {pessoa.maeId ? nomeCompletoPorId(pessoa.maeId) : 'não informada'}</span>}
                      {pessoa.conjugeId && <span>Cônjuge: {nomeCompletoPorId(pessoa.conjugeId)}</span>}
                      {filhos.length > 0 && <span>Filhos: {filhos.map(filho => `${filho.nome} ${filho.sobrenome}`).join(', ')}</span>}
                    </div>
                    <div className="acoes-pessoa">
                      <button type="button" className="botao-editar" onClick={() => editarPessoa(pessoa)}>Editar</button>
                      <button type="button" className="botao-excluir" onClick={() => excluirPessoa(pessoa)}>Excluir</button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

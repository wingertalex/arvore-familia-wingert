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
  cidadeNatal?: string
  cidadeAtual?: string
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
  cidadeNatal: string
  cidadeAtual: string
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
  cidadeNatal: '',
  cidadeAtual: '',
  bairro: '',
  paiId: '',
  maeId: '',
  casada: false,
  conjugeId: '',
  novoPai: {...cadastroRapidoInicial},
  novaMae: {...cadastroRapidoInicial},
}

function nomeCompleto(pessoa?: Pessoa) {
  return pessoa ? `${pessoa.nome} ${pessoa.sobrenome}` : 'Pessoa não encontrada'
}

function formatarData(data?: string) {
  if (!data) return ''
  const [ano, mes, dia] = data.split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
}

type NoArvoreProps = {
  pessoa: Pessoa
  pessoas: Pessoa[]
  caminho?: Set<string>
}

function NoArvore({pessoa, pessoas, caminho = new Set()}: NoArvoreProps) {
  if (caminho.has(pessoa.id)) {
    return <div className="no-arvore aviso-ciclo">Vínculo circular detectado</div>
  }

  const novoCaminho = new Set(caminho)
  novoCaminho.add(pessoa.id)
  const conjuge = pessoa.conjugeId ? pessoas.find(item => item.id === pessoa.conjugeId) : undefined
  const filhos = pessoas.filter(item => item.paiId === pessoa.id || item.maeId === pessoa.id)
  const filhosUnicos = filhos.filter((filho, indice, lista) => lista.findIndex(item => item.id === filho.id) === indice)

  return (
    <div className="ramo-arvore">
      <div className="casal-arvore">
        <article className="no-arvore">
          <strong>{nomeCompleto(pessoa)}</strong>
          {pessoa.nascimento && <span>Nasc. {formatarData(pessoa.nascimento)}</span>}
          {pessoa.cidadeNatal && <span>Natural de {pessoa.cidadeNatal}</span>}
          {pessoa.cidadeAtual && <span>Atual: {pessoa.cidadeAtual}</span>}
        </article>
        {conjuge && (
          <>
            <span className="uniao" aria-label="casado com">♥</span>
            <article className="no-arvore conjuge">
              <strong>{nomeCompleto(conjuge)}</strong>
              {conjuge.nascimento && <span>Nasc. {formatarData(conjuge.nascimento)}</span>}
              {conjuge.cidadeNatal && <span>Natural de {conjuge.cidadeNatal}</span>}
              {conjuge.cidadeAtual && <span>Atual: {conjuge.cidadeAtual}</span>}
            </article>
          </>
        )}
      </div>

      {filhosUnicos.length > 0 && (
        <div className="descendentes">
          {filhosUnicos.map(filho => (
            <NoArvore key={filho.id} pessoa={filho} pessoas={pessoas} caminho={novoCaminho} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [pessoaEmEdicao, setPessoaEmEdicao] = useState<string | null>(null)
  const [formulario, setFormulario] = useState<FormularioPessoa>(formularioInicial)
  const visualizandoArvore = new URLSearchParams(window.location.search).get('view') === 'tree'

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
      snapshot => setPessoas(snapshot.docs.map(documento => ({id: documento.id, ...documento.data()} as Pessoa))),
      () => setErro('Não foi possível carregar as pessoas cadastradas.'),
    )
  }, [usuario])

  const pessoasDisponiveis = useMemo(
    () => pessoas.filter(pessoa => pessoa.id !== pessoaEmEdicao),
    [pessoas, pessoaEmEdicao],
  )

  const raizesDaArvore = useMemo(() => {
    const ids = new Set(pessoas.map(pessoa => pessoa.id))
    const raizes = pessoas.filter(pessoa => (!pessoa.paiId || !ids.has(pessoa.paiId)) && (!pessoa.maeId || !ids.has(pessoa.maeId)))
    const idsConjugesJaIncluidos = new Set<string>()

    return raizes.filter(pessoa => {
      if (idsConjugesJaIncluidos.has(pessoa.id)) return false
      if (pessoa.conjugeId) idsConjugesJaIncluidos.add(pessoa.conjugeId)
      return true
    })
  }, [pessoas])

  function nomeCompletoPorId(id?: string) {
    return nomeCompleto(pessoas.find(item => item.id === id))
  }

  function filhosDe(pessoaId: string) {
    return pessoas.filter(pessoa => pessoa.paiId === pessoaId || pessoa.maeId === pessoaId)
  }

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    const dados = new FormData(event.currentTarget)

    try {
      await signInWithEmailAndPassword(auth, String(dados.get('email')), String(dados.get('senha')))
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
      cidadeNatal: pessoa.cidadeNatal || '',
      cidadeAtual: pessoa.cidadeAtual || pessoa.cidade || '',
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
    if (formulario.paiId && formulario.paiId === formulario.maeId) return 'Pai e mãe não podem ser a mesma pessoa.'
    if (formulario.casada && !formulario.conjugeId) return 'Selecione o cônjuge ou desmarque a opção “Pessoa casada”.'
    if (formulario.conjugeId && [formulario.paiId, formulario.maeId].includes(formulario.conjugeId)) return 'O cônjuge não pode ser a mesma pessoa cadastrada como pai ou mãe.'
    if (formulario.novoPai.ativo && (!formulario.novoPai.nome.trim() || !formulario.novoPai.sobrenome.trim())) return 'Informe nome e sobrenome do novo pai.'
    if (formulario.novaMae.ativo && (!formulario.novaMae.nome.trim() || !formulario.novaMae.sobrenome.trim())) return 'Informe nome e sobrenome da nova mãe.'
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

      const criarParenteRapido = (cadastro: CadastroRapido) => {
        const referencia = doc(collection(db, 'pessoas'))
        batch.set(referencia, {
          nome: cadastro.nome.trim(),
          sobrenome: cadastro.sobrenome.trim(),
          nascimento: '',
          falecimento: '',
          viva: cadastro.viva,
          cidadeNatal: '',
          cidadeAtual: '',
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
        return referencia.id
      }

      if (formulario.novoPai.ativo) paiId = criarParenteRapido(formulario.novoPai)
      if (formulario.novaMae.ativo) maeId = criarParenteRapido(formulario.novaMae)

      const referenciaPessoa = pessoaEmEdicao ? doc(db, 'pessoas', pessoaEmEdicao) : doc(collection(db, 'pessoas'))
      const pessoaAnterior = pessoaEmEdicao ? pessoas.find(pessoa => pessoa.id === pessoaEmEdicao) : undefined
      const conjugeAnteriorId = pessoaAnterior?.conjugeId || ''
      const novoConjugeId = formulario.casada ? formulario.conjugeId : ''

      const dadosPessoa = {
        nome: formulario.nome.trim(),
        sobrenome: formulario.sobrenome.trim(),
        nascimento: formulario.nascimento,
        falecimento: formulario.viva ? '' : formulario.falecimento,
        viva: formulario.viva,
        cidadeNatal: formulario.cidadeNatal.trim(),
        cidadeAtual: formulario.cidadeAtual.trim(),
        bairro: formulario.bairro.trim(),
        paiId,
        maeId,
        casada: formulario.casada,
        conjugeId: novoConjugeId,
        atualizadoPor: usuario?.uid,
        atualizadoEm: serverTimestamp(),
      }

      if (pessoaEmEdicao) batch.update(referenciaPessoa, dadosPessoa)
      else batch.set(referenciaPessoa, {...dadosPessoa, criadoPor: usuario?.uid, criadoEm: serverTimestamp()})

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
        if (conjugeSelecionado?.conjugeId && conjugeSelecionado.conjugeId !== referenciaPessoa.id) throw new Error('Cônjuge já vinculado')

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
      setErro(error instanceof Error && error.message === 'Cônjuge já vinculado'
        ? 'A pessoa selecionada já possui outro cônjuge vinculado.'
        : 'Não foi possível salvar. Confira os vínculos e as regras do Firestore.')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirPessoa(pessoa: Pessoa) {
    const filhos = filhosDe(pessoa.id)
    if (filhos.length > 0) {
      setErro(`${nomeCompleto(pessoa)} possui ${filhos.length} vínculo(s) como pai ou mãe. Remova esses vínculos antes de excluir.`)
      return
    }
    if (pessoa.conjugeId) {
      setErro(`Remova primeiro o vínculo conjugal de ${nomeCompleto(pessoa)}.`)
      return
    }
    if (!window.confirm(`Deseja realmente excluir ${nomeCompleto(pessoa)}? Esta ação não poderá ser desfeita.`)) return

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

  if (visualizandoArvore) {
    return (
      <main className="pagina-arvore">
        <header>
          <div><span className="marca">Família Wingert</span><h1>Visualização da árvore</h1></div>
          <div className="acoes-cabecalho">
            <a className="botao-link secundario" href="/">Voltar ao cadastro</a>
            <button className="secundario" onClick={() => signOut(auth)}>Sair</button>
          </div>
        </header>
        <section className="area-arvore">
          {pessoas.length === 0 ? <p>Nenhuma pessoa cadastrada ainda.</p> : raizesDaArvore.map(raiz => (
            <NoArvore key={raiz.id} pessoa={raiz} pessoas={pessoas} />
          ))}
        </section>
      </main>
    )
  }

  return (
    <main>
      <header>
        <div><span className="marca">Família Wingert</span><h1>Árvore genealógica</h1></div>
        <div className="acoes-cabecalho">
          <a className="botao-link" href="/?view=tree" target="_blank" rel="noreferrer">Visualizar árvore</a>
          <button className="secundario" onClick={() => signOut(auth)}>Sair</button>
        </div>
      </header>

      <div className="conteudo">
        <section className="painel">
          <h2>{pessoaEmEdicao ? 'Editar pessoa' : 'Cadastrar pessoa'}</h2>
          <form className="grade" onSubmit={salvarPessoa}>
            <label>Nome<input value={formulario.nome} onChange={event => setFormulario({...formulario, nome: event.target.value})} required /></label>
            <label>Sobrenome<input value={formulario.sobrenome} onChange={event => setFormulario({...formulario, sobrenome: event.target.value})} required /></label>
            <label>Nascimento<input type="date" value={formulario.nascimento} onChange={event => setFormulario({...formulario, nascimento: event.target.value})} /></label>
            <label>Falecimento<input type="date" value={formulario.falecimento} disabled={formulario.viva} onChange={event => setFormulario({...formulario, falecimento: event.target.value})} /></label>
            <label>Cidade natal (opcional)<input value={formulario.cidadeNatal} onChange={event => setFormulario({...formulario, cidadeNatal: event.target.value})} placeholder="Ex.: Dois Irmãos" /></label>
            <label>Cidade atual (opcional)<input value={formulario.cidadeAtual} onChange={event => setFormulario({...formulario, cidadeAtual: event.target.value})} placeholder="Ex.: Porto Alegre" /></label>
            <label className="campo-largo">Bairro atual (opcional)<input value={formulario.bairro} onChange={event => setFormulario({...formulario, bairro: event.target.value})} placeholder="Ex.: Centro" /></label>

            <fieldset className="grupo-vinculo">
              <legend>Pai</legend>
              <label>Selecionar pessoa cadastrada<select value={formulario.paiId} disabled={formulario.novoPai.ativo} onChange={event => setFormulario({...formulario, paiId: event.target.value})}><option value="">Não informado</option>{pessoasDisponiveis.map(pessoa => <option key={pessoa.id} value={pessoa.id}>{nomeCompleto(pessoa)}</option>)}</select></label>
              <label className="checkbox"><input type="checkbox" checked={formulario.novoPai.ativo} onChange={event => setFormulario({...formulario, paiId: '', novoPai: {...formulario.novoPai, ativo: event.target.checked}})} />Cadastrar um novo pai agora</label>
              {formulario.novoPai.ativo && <div className="cadastro-rapido"><label>Nome do pai<input value={formulario.novoPai.nome} onChange={event => setFormulario({...formulario, novoPai: {...formulario.novoPai, nome: event.target.value}})} required /></label><label>Sobrenome do pai<input value={formulario.novoPai.sobrenome} onChange={event => setFormulario({...formulario, novoPai: {...formulario.novoPai, sobrenome: event.target.value}})} required /></label><label className="checkbox"><input type="checkbox" checked={formulario.novoPai.viva} onChange={event => setFormulario({...formulario, novoPai: {...formulario.novoPai, viva: event.target.checked}})} />Pessoa viva</label></div>}
            </fieldset>

            <fieldset className="grupo-vinculo">
              <legend>Mãe</legend>
              <label>Selecionar pessoa cadastrada<select value={formulario.maeId} disabled={formulario.novaMae.ativo} onChange={event => setFormulario({...formulario, maeId: event.target.value})}><option value="">Não informada</option>{pessoasDisponiveis.map(pessoa => <option key={pessoa.id} value={pessoa.id}>{nomeCompleto(pessoa)}</option>)}</select></label>
              <label className="checkbox"><input type="checkbox" checked={formulario.novaMae.ativo} onChange={event => setFormulario({...formulario, maeId: '', novaMae: {...formulario.novaMae, ativo: event.target.checked}})} />Cadastrar uma nova mãe agora</label>
              {formulario.novaMae.ativo && <div className="cadastro-rapido"><label>Nome da mãe<input value={formulario.novaMae.nome} onChange={event => setFormulario({...formulario, novaMae: {...formulario.novaMae, nome: event.target.value}})} required /></label><label>Sobrenome da mãe<input value={formulario.novaMae.sobrenome} onChange={event => setFormulario({...formulario, novaMae: {...formulario.novaMae, sobrenome: event.target.value}})} required /></label><label className="checkbox"><input type="checkbox" checked={formulario.novaMae.viva} onChange={event => setFormulario({...formulario, novaMae: {...formulario.novaMae, viva: event.target.checked}})} />Pessoa viva</label></div>}
            </fieldset>

            <label className="checkbox"><input type="checkbox" checked={formulario.viva} onChange={event => setFormulario({...formulario, viva: event.target.checked, falecimento: event.target.checked ? '' : formulario.falecimento})} />Pessoa viva</label>
            <label className="checkbox"><input type="checkbox" checked={formulario.casada} onChange={event => setFormulario({...formulario, casada: event.target.checked, conjugeId: event.target.checked ? formulario.conjugeId : ''})} />Pessoa casada</label>
            {formulario.casada && <label className="campo-largo">Cônjuge<select value={formulario.conjugeId} onChange={event => setFormulario({...formulario, conjugeId: event.target.value})} required><option value="">Selecione o cônjuge</option>{pessoasDisponiveis.map(pessoa => <option key={pessoa.id} value={pessoa.id}>{nomeCompleto(pessoa)}</option>)}</select></label>}

            <div className="acoes-formulario">
              {pessoaEmEdicao && <button type="button" className="botao-neutro" onClick={limparFormulario}>Cancelar</button>}
              <button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : pessoaEmEdicao ? 'Salvar alterações' : 'Salvar pessoa'}</button>
            </div>
          </form>
          {erro && <p className="erro">{erro}</p>}
        </section>

        <section className="painel">
          <div className="titulo-lista"><h2>Pessoas cadastradas</h2><span>{pessoas.length}</span></div>
          {pessoas.length === 0 ? <p>Nenhuma pessoa cadastrada ainda.</p> : <div className="lista">{pessoas.map(pessoa => {
            const filhos = filhosDe(pessoa.id)
            const atual = [pessoa.bairro, pessoa.cidadeAtual || pessoa.cidade].filter(Boolean).join(', ')
            return <article key={pessoa.id}><div className="dados-pessoa"><strong>{nomeCompleto(pessoa)}</strong><span>{pessoa.nascimento ? `Nascimento: ${formatarData(pessoa.nascimento)}` : 'Nascimento não informado'}{!pessoa.viva && pessoa.falecimento ? ` — Falecimento: ${formatarData(pessoa.falecimento)}` : ''}</span>{pessoa.cidadeNatal && <span>Cidade natal: {pessoa.cidadeNatal}</span>}{atual && <span>Residência atual: {atual}</span>}{(pessoa.paiId || pessoa.maeId) && <span>Pais: {pessoa.paiId ? nomeCompletoPorId(pessoa.paiId) : 'não informado'} / {pessoa.maeId ? nomeCompletoPorId(pessoa.maeId) : 'não informada'}</span>}{pessoa.conjugeId && <span>Cônjuge: {nomeCompletoPorId(pessoa.conjugeId)}</span>}{filhos.length > 0 && <span>Filhos: {filhos.map(nomeCompleto).join(', ')}</span>}</div><div className="acoes-pessoa"><button type="button" className="botao-editar" onClick={() => editarPessoa(pessoa)}>Editar</button><button type="button" className="botao-excluir" onClick={() => excluirPessoa(pessoa)}>Excluir</button></div></article>
          })}</div>}
        </section>
      </div>
    </main>
  )
}

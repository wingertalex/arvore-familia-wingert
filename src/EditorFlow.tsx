import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  applyNodeChanges,
  Edge,
  NodeChange,
  useReactFlow,
} from '@xyflow/react'
import {onAuthStateChanged} from 'firebase/auth'
import {collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch} from 'firebase/firestore'
import {auth, db} from './firebase'

type Pessoa = {
  id: string
  nome: string
  sobrenome: string
  sexo?: 'Masculino' | 'Feminino'
  nascimento?: string
  falecimento?: string
  cidadeAtual?: string
  cidade?: string
  paiId?: string
  maeId?: string
  conjugeId?: string
}

type PessoaNodeData = {pessoa: Pessoa}
type PessoaNode = Node<PessoaNodeData, 'pessoa'>

const nome = (p?: Pessoa) => p ? `${p.nome} ${p.sobrenome}` : 'Pessoa não encontrada'
const dataBR = (d?: string) => d ? d.split('-').reverse().join('/') : ''

function PessoaCard({data, selected}: NodeProps<PessoaNode>) {
  const p = data.pessoa
  return (
    <article className={`flow-card ${selected ? 'selecionado' : ''}`}>
      <Handle type="target" position={Position.Top} id="pais" />
      <Handle type="source" position={Position.Bottom} id="filhos" />
      <Handle type="source" position={Position.Right} id="conjuge-direita" />
      <Handle type="target" position={Position.Left} id="conjuge-esquerda" />
      <span className="sexo">{p.sexo || '—'}</span>
      <strong>{nome(p)}</strong>
      {p.nascimento && <span>★ {dataBR(p.nascimento)}</span>}
      {p.falecimento && <span>✝ {dataBR(p.falecimento)}</span>}
      {(p.cidadeAtual || p.cidade) && <span>{p.cidadeAtual || p.cidade}</span>}
    </article>
  )
}

const nodeTypes = {pessoa: PessoaCard}

export default function EditorFlow() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [nodes, setNodes] = useState<PessoaNode[]>([])
  const [selecionado, setSelecionado] = useState('')
  const [adicionarId, setAdicionarId] = useState('')
  const [relacionarId, setRelacionarId] = useState('')
  const [status, setStatus] = useState('Carregando…')
  const {fitView} = useReactFlow<PessoaNode, Edge>()

  const porId = useCallback((id?: string) => pessoas.find(p => p.id === id), [pessoas])

  const parentesDiretos = useMemo(() => {
    const p = porId(selecionado)
    if (!p) return pessoas
    const ids = new Set([p.paiId, p.maeId, p.conjugeId].filter(Boolean) as string[])
    pessoas.forEach(x => {
      if (x.paiId === p.id || x.maeId === p.id) ids.add(x.id)
      if (x.id !== p.id && ((p.paiId && x.paiId === p.paiId) || (p.maeId && x.maeId === p.maeId))) ids.add(x.id)
    })
    return pessoas.filter(x => ids.has(x.id))
  }, [pessoas, porId, selecionado])

  const edges = useMemo<Edge[]>(() => {
    const visiveis = new Set(nodes.map(n => n.id))
    const resultado: Edge[] = []
    pessoas.forEach(p => {
      if (!visiveis.has(p.id)) return
      if (p.paiId && visiveis.has(p.paiId)) resultado.push({id: `pai-${p.paiId}-${p.id}`, source: p.paiId, target: p.id, sourceHandle: 'filhos', targetHandle: 'pais', type: 'smoothstep', style: {stroke: '#4f7b66', strokeWidth: 3}})
      if (p.maeId && visiveis.has(p.maeId)) resultado.push({id: `mae-${p.maeId}-${p.id}`, source: p.maeId, target: p.id, sourceHandle: 'filhos', targetHandle: 'pais', type: 'smoothstep', style: {stroke: '#7b5f8d', strokeWidth: 3}})
      if (p.conjugeId && visiveis.has(p.conjugeId) && p.id < p.conjugeId) resultado.push({id: `conjuge-${p.id}-${p.conjugeId}`, source: p.id, target: p.conjugeId, sourceHandle: 'conjuge-direita', targetHandle: 'conjuge-esquerda', type: 'straight', style: {stroke: '#9a6b5a', strokeWidth: 3}})
    })
    return resultado
  }, [nodes, pessoas])

  useEffect(() => onAuthStateChanged(auth, async usuario => {
    if (!usuario) {
      location.href = '/'
      return
    }
    try {
      const snap = await getDocs(query(collection(db, 'pessoas'), orderBy('nome')))
      const lista = snap.docs.map(d => ({id: d.id, ...d.data()} as Pessoa))
      setPessoas(lista)
      const desenho = await getDoc(doc(db, 'diagramas', 'arvore-principal'))
      const dados = desenho.exists() ? desenho.data() : {}
      const posicoes = (dados.posicoes || {}) as Record<string, {x: number; y: number}>
      const visiveis = new Set<string>(dados.visiveis || [])
      const iniciais = lista.filter(p => visiveis.has(p.id)).map((p, i) => ({
        id: p.id,
        type: 'pessoa' as const,
        position: posicoes[p.id] || {x: 180 + (i % 4) * 300, y: 120 + Math.floor(i / 4) * 220},
        data: {pessoa: p},
      }))
      setNodes(iniciais)
      setStatus(`${lista.length} pessoas cadastradas.`)
      requestAnimationFrame(() => fitView({padding: 0.25, duration: 500}))
    } catch (error) {
      console.error(error)
      setStatus('Erro ao carregar o editor.')
    }
  }), [fitView])

  useEffect(() => {
    setNodes(atuais => atuais.map(n => ({...n, data: {pessoa: porId(n.id) || n.data.pessoa}})))
  }, [pessoas, porId])

  const onNodesChange = useCallback((changes: NodeChange<PessoaNode>[]) => {
    setNodes(atuais => applyNodeChanges(changes, atuais))
  }, [])

  function adicionarPessoa() {
    const p = porId(adicionarId)
    if (!p || nodes.some(n => n.id === p.id)) return
    const base = nodes.find(n => n.id === selecionado)
    setNodes(atuais => [...atuais, {
      id: p.id,
      type: 'pessoa',
      position: base ? {x: base.position.x + 300, y: base.position.y} : {x: 200, y: 160},
      data: {pessoa: p},
    }])
    setSelecionado(p.id)
    setAdicionarId('')
  }

  async function relacionar(tipo: 'pai' | 'mae' | 'conjuge' | 'filho' | 'irmao') {
    const alvo = porId(selecionado)
    const outro = porId(relacionarId)
    if (!alvo || !outro || alvo.id === outro.id) return
    try {
      const batch = writeBatch(db)
      if (tipo === 'pai') batch.update(doc(db, 'pessoas', alvo.id), {paiId: outro.id, atualizadoEm: serverTimestamp()})
      if (tipo === 'mae') batch.update(doc(db, 'pessoas', alvo.id), {maeId: outro.id, atualizadoEm: serverTimestamp()})
      if (tipo === 'conjuge') {
        batch.update(doc(db, 'pessoas', alvo.id), {conjugeId: outro.id, casada: true, atualizadoEm: serverTimestamp()})
        batch.update(doc(db, 'pessoas', outro.id), {conjugeId: alvo.id, casada: true, atualizadoEm: serverTimestamp()})
      }
      if (tipo === 'filho') batch.update(doc(db, 'pessoas', outro.id), {[alvo.sexo === 'Feminino' ? 'maeId' : 'paiId']: alvo.id, atualizadoEm: serverTimestamp()})
      if (tipo === 'irmao') batch.update(doc(db, 'pessoas', outro.id), {paiId: alvo.paiId || '', maeId: alvo.maeId || '', atualizadoEm: serverTimestamp()})
      await batch.commit()
      const snap = await getDocs(query(collection(db, 'pessoas'), orderBy('nome')))
      const lista = snap.docs.map(d => ({id: d.id, ...d.data()} as Pessoa))
      setPessoas(lista)
      if (!nodes.some(n => n.id === outro.id)) {
        const base = nodes.find(n => n.id === alvo.id)
        const pos = base?.position || {x: 200, y: 200}
        const nova = tipo === 'pai' || tipo === 'mae'
          ? {x: pos.x + (tipo === 'pai' ? -140 : 140), y: pos.y - 220}
          : tipo === 'filho'
            ? {x: pos.x, y: pos.y + 220}
            : {x: pos.x + 300, y: pos.y}
        setNodes(atuais => [...atuais, {id: outro.id, type: 'pessoa', position: nova, data: {pessoa: outro}}])
      }
      setStatus('Vínculo salvo.')
      setRelacionarId('')
    } catch (error) {
      console.error(error)
      setStatus('Erro ao salvar o vínculo.')
    }
  }

  async function salvar() {
    setStatus('Salvando desenho…')
    try {
      const posicoes = Object.fromEntries(nodes.map(n => [n.id, n.position]))
      await setDoc(doc(db, 'diagramas', 'arvore-principal'), {
        posicoes,
        visiveis: nodes.map(n => n.id),
        atualizadoEm: serverTimestamp(),
      }, {merge: true})
      setStatus('Desenho salvo no Firebase.')
    } catch (error) {
      console.error(error)
      setStatus('Não foi possível salvar o desenho.')
    }
  }

  function alinharGeracoes() {
    const nivel = new Map<string, number>()
    const calc = (id: string, pilha = new Set<string>()): number => {
      if (nivel.has(id)) return nivel.get(id)!
      if (pilha.has(id)) return 0
      pilha.add(id)
      const p = porId(id)
      const n = Math.max(p?.paiId ? calc(p.paiId, new Set(pilha)) + 1 : 0, p?.maeId ? calc(p.maeId, new Set(pilha)) + 1 : 0)
      nivel.set(id, n)
      return n
    }
    nodes.forEach(n => calc(n.id))
    const grupos = new Map<number, PessoaNode[]>()
    nodes.forEach(n => {
      const g = nivel.get(n.id) || 0
      grupos.set(g, [...(grupos.get(g) || []), n])
    })
    setNodes(atuais => atuais.map(n => {
      const g = nivel.get(n.id) || 0
      const grupo = grupos.get(g) || []
      const indice = grupo.findIndex(x => x.id === n.id)
      return {...n, position: {x: indice * 300, y: g * 230}}
    }))
    requestAnimationFrame(() => fitView({padding: 0.2, duration: 400}))
  }

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <div><span className="marca">Família Wingert</span><h1>Editor da árvore</h1></div>
        <nav><a href="/">Cadastro</a><a href="/estatisticas.html">Estatísticas</a><button onClick={salvar}>Salvar desenho</button><button onClick={() => window.print()}>PDF</button></nav>
      </header>
      <div className="editor-layout">
        <aside className="editor-sidebar">
          <section><h2>Adicionar quadro</h2><select value={adicionarId} onChange={e => setAdicionarId(e.target.value)}><option value="">{selecionado ? 'Selecione um parente direto' : 'Selecione uma pessoa'}</option>{parentesDiretos.filter(p => !nodes.some(n => n.id === p.id)).map(p => <option key={p.id} value={p.id}>{nome(p)}</option>)}</select><button onClick={adicionarPessoa}>Adicionar ao desenho</button></section>
          <section><h2>Relacionar com selecionado</h2><select value={relacionarId} onChange={e => setRelacionarId(e.target.value)}><option value="">Selecione outra pessoa</option>{pessoas.filter(p => p.id !== selecionado).map(p => <option key={p.id} value={p.id}>{nome(p)}</option>)}</select><div className="grid-botoes"><button onClick={() => relacionar('pai')}>É pai</button><button onClick={() => relacionar('mae')}>É mãe</button><button onClick={() => relacionar('conjuge')}>É cônjuge</button><button onClick={() => relacionar('filho')}>É filho(a)</button><button onClick={() => relacionar('irmao')}>É irmão(ã)</button><button className="perigo" onClick={() => {setNodes(ns => ns.filter(n => n.id !== selecionado)); setSelecionado('')}}>Remover quadro</button></div></section>
          <section><h2>Organização</h2><div className="grid-botoes"><button onClick={alinharGeracoes}>Alinhar gerações</button><button onClick={() => fitView({padding: 0.2, duration: 400})}>Ajustar à tela</button></div></section>
          <p className="ajuda">Arraste os quadros livremente. O espaço é infinito e as linhas acompanham os nós automaticamente.</p>
          <p className="status">{status}</p>
        </aside>
        <section className="flow-area">
          <ReactFlow<PessoaNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeClick={(_, node) => setSelecionado(node.id)}
            onPaneClick={() => setSelecionado('')}
            fitView
            minZoom={0.2}
            maxZoom={1.8}
            deleteKeyCode={null}
          >
            <Background gap={32} size={1} />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </section>
      </div>
    </main>
  )
}
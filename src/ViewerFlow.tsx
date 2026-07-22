import {useEffect, useMemo, useState} from 'react'
import {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react'
import {collection, doc, getDoc, getDocs, orderBy, query} from 'firebase/firestore'
import {db} from './firebase'

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

function PessoaCard({data}: NodeProps<PessoaNode>) {
  const p = data.pessoa
  return (
    <article className="viewer-card">
      <Handle type="target" position={Position.Top} id="pais" isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="filhos" isConnectable={false} />
      <Handle type="source" position={Position.Right} id="conjuge-direita" isConnectable={false} />
      <Handle type="target" position={Position.Left} id="conjuge-esquerda" isConnectable={false} />
      <span className="sexo">{p.sexo || '—'}</span>
      <strong>{nome(p)}</strong>
      {p.nascimento && <span>★ {dataBR(p.nascimento)}</span>}
      {p.falecimento && <span>✝ {dataBR(p.falecimento)}</span>}
      {(p.cidadeAtual || p.cidade) && <span>{p.cidadeAtual || p.cidade}</span>}
    </article>
  )
}

const nodeTypes = {pessoa: PessoaCard}

export default function ViewerFlow() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [nodes, setNodes] = useState<PessoaNode[]>([])
  const [status, setStatus] = useState('Carregando árvore…')
  const {fitView} = useReactFlow<PessoaNode, Edge>()

  const edges = useMemo<Edge[]>(() => {
    const visiveis = new Set(nodes.map(n => n.id))
    const resultado: Edge[] = []

    pessoas.forEach(p => {
      if (!visiveis.has(p.id)) return
      if (p.paiId && visiveis.has(p.paiId)) resultado.push({
        id: `pai-${p.paiId}-${p.id}`,
        source: p.paiId,
        target: p.id,
        sourceHandle: 'filhos',
        targetHandle: 'pais',
        type: 'smoothstep',
        style: {stroke: '#4f7b66', strokeWidth: 3},
      })
      if (p.maeId && visiveis.has(p.maeId)) resultado.push({
        id: `mae-${p.maeId}-${p.id}`,
        source: p.maeId,
        target: p.id,
        sourceHandle: 'filhos',
        targetHandle: 'pais',
        type: 'smoothstep',
        style: {stroke: '#7b5f8d', strokeWidth: 3},
      })
      if (p.conjugeId && visiveis.has(p.conjugeId) && p.id < p.conjugeId) resultado.push({
        id: `conjuge-${p.id}-${p.conjugeId}`,
        source: p.id,
        target: p.conjugeId,
        sourceHandle: 'conjuge-direita',
        targetHandle: 'conjuge-esquerda',
        type: 'straight',
        style: {stroke: '#9a6b5a', strokeWidth: 3},
      })
    })

    return resultado
  }, [nodes, pessoas])

  useEffect(() => {
    async function carregar() {
      try {
        const [pessoasSnap, desenhoSnap] = await Promise.all([
          getDocs(query(collection(db, 'pessoas'), orderBy('nome'))),
          getDoc(doc(db, 'diagramas', 'arvore-principal')),
        ])

        const lista = pessoasSnap.docs.map(d => ({id: d.id, ...d.data()} as Pessoa))
        const desenho = desenhoSnap.exists() ? desenhoSnap.data() : {}
        const posicoes = (desenho.posicoes || {}) as Record<string, {x: number; y: number}>
        const visiveis = new Set<string>(desenho.visiveis || [])
        const iniciais = lista.filter(p => visiveis.has(p.id)).map((p, i) => ({
          id: p.id,
          type: 'pessoa' as const,
          position: posicoes[p.id] || {x: 180 + (i % 4) * 300, y: 120 + Math.floor(i / 4) * 220},
          data: {pessoa: p},
          draggable: false,
          selectable: false,
          connectable: false,
        }))

        setPessoas(lista)
        setNodes(iniciais)
        setStatus(iniciais.length ? `${iniciais.length} pessoas na árvore desenhada.` : 'A árvore desenhada ainda não possui pessoas visíveis.')
        requestAnimationFrame(() => fitView({padding: 0.2, duration: 600}))
      } catch (error) {
        console.error(error)
        setStatus('Não foi possível carregar a árvore desenhada.')
      }
    }

    carregar()
  }, [fitView])

  return (
    <main className="viewer-shell">
      <header className="viewer-header">
        <div>
          <span className="marca">Projeto Raízes Wingert</span>
          <h1>Árvore genealógica desenhada</h1>
          <p>{status}</p>
        </div>
        <nav>
          <a href="/">Página inicial</a>
          <a href="/arvore-publica.html">Lista de pessoas</a>
        </nav>
      </header>

      <section className="viewer-area" aria-label="Visualização pública da árvore genealógica desenhada">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          fitView
          minZoom={0.1}
          maxZoom={2}
          proOptions={{hideAttribution: true}}
        >
          <Background gap={24} size={1} color="#cfd8d1" />
          <MiniMap pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </section>
    </main>
  )
}

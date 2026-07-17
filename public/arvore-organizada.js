const auth = firebase.auth()
const db = firebase.firestore()
const canvas = document.querySelector('#canvas')
const geracoesEl = document.querySelector('#geracoes')
const svg = document.querySelector('#linhas')
const statusEl = document.querySelector('#status')
const foco = document.querySelector('#foco')
let pessoas = []
let nucleosVisiveis = []

const PALETA = ['#346751', '#8a5a44', '#506aa0', '#8a6b24', '#76528b', '#30777d', '#9a4f62', '#5d7140']
const nome = pessoa => pessoa ? `${pessoa.nome} ${pessoa.sobrenome}` : 'Não informado'
const dataBR = data => data ? data.split('-').reverse().join('/') : ''
const porId = id => pessoas.find(pessoa => pessoa.id === id)
const chavePar = (a, b) => [a, b].filter(Boolean).sort().join('|')
const hash = texto => [...texto].reduce((total, caractere) => ((total * 31) + caractere.charCodeAt(0)) >>> 0, 7)
const corDoId = id => PALETA[hash(id) % PALETA.length]

function criarNucleos() {
  const pares = new Set()
  pessoas.forEach(pessoa => {
    if (pessoa.conjugeId && porId(pessoa.conjugeId)) pares.add(chavePar(pessoa.id, pessoa.conjugeId))
  })

  const pessoaParaNucleo = new Map()
  const nucleos = []
  const usados = new Set()

  pares.forEach(chave => {
    const parceiros = chave.split('|').map(porId).filter(Boolean)
    const nucleo = {id: chave, parceiros, pais: new Set(), filhos: new Set(), ligacoesPais: [], geracao: 0, cor: corDoId(chave)}
    nucleos.push(nucleo)
    parceiros.forEach(pessoa => {
      usados.add(pessoa.id)
      pessoaParaNucleo.set(pessoa.id, nucleo)
    })
  })

  pessoas.forEach(pessoa => {
    if (usados.has(pessoa.id)) return
    const nucleo = {id: pessoa.id, parceiros: [pessoa], pais: new Set(), filhos: new Set(), ligacoesPais: [], geracao: 0, cor: corDoId(pessoa.id)}
    nucleos.push(nucleo)
    pessoaParaNucleo.set(pessoa.id, nucleo)
  })

  nucleos.forEach(nucleo => {
    nucleo.parceiros.forEach(filho => {
      const paisPorNucleo = new Map()
      ;[filho.paiId, filho.maeId].filter(Boolean).forEach(parentId => {
        const paiNucleo = pessoaParaNucleo.get(parentId)
        if (!paiNucleo || paiNucleo.id === nucleo.id) return
        paisPorNucleo.set(paiNucleo.id, paiNucleo)
      })
      paisPorNucleo.forEach(paiNucleo => {
        nucleo.pais.add(paiNucleo.id)
        paiNucleo.filhos.add(nucleo.id)
        nucleo.ligacoesPais.push({paiNucleoId: paiNucleo.id, filhoPessoaId: filho.id})
      })
    })
  })

  const mapa = new Map(nucleos.map(nucleo => [nucleo.id, nucleo]))
  nucleos.forEach(nucleo => {
    if (!nucleo.filhos.size && nucleo.pais.size) {
      const primeiroPai = mapa.get([...nucleo.pais][0])
      if (primeiroPai) nucleo.cor = primeiroPai.cor
    }
  })

  return {nucleos, pessoaParaNucleo}
}

function filtrarComponente(base) {
  if (!foco.value) return base.nucleos
  const inicial = base.pessoaParaNucleo.get(foco.value)
  if (!inicial) return []
  const mapa = new Map(base.nucleos.map(nucleo => [nucleo.id, nucleo]))
  const visitados = new Set()
  const fila = [inicial.id]
  while (fila.length) {
    const id = fila.shift()
    if (visitados.has(id)) continue
    visitados.add(id)
    const nucleo = mapa.get(id)
    if (nucleo) [...nucleo.pais, ...nucleo.filhos].forEach(vinculo => fila.push(vinculo))
  }
  return base.nucleos.filter(nucleo => visitados.has(nucleo.id))
}

function calcularGeracoes(nucleos) {
  const mapa = new Map(nucleos.map(nucleo => [nucleo.id, nucleo]))
  nucleos.forEach(nucleo => { nucleo.geracao = 0 })
  for (let tentativa = 0; tentativa < nucleos.length * 2; tentativa++) {
    let mudou = false
    nucleos.forEach(nucleo => {
      const pais = [...nucleo.pais].map(id => mapa.get(id)).filter(Boolean)
      const nova = pais.length ? Math.max(...pais.map(pai => pai.geracao)) + 1 : 0
      if (nova > nucleo.geracao) {
        nucleo.geracao = nova
        mudou = true
      }
    })
    if (!mudou) break
  }
}

function criarMembro(pessoa) {
  const div = document.createElement('div')
  div.className = 'membro'
  div.dataset.pessoaId = pessoa.id
  const nascimento = pessoa.nascimento ? `<span title="Nascimento">★ ${dataBR(pessoa.nascimento)}</span>` : ''
  const falecimento = pessoa.falecimento ? `<span title="Falecimento">✝ ${dataBR(pessoa.falecimento)}</span>` : ''
  const sexo = pessoa.sexo ? `<span>${pessoa.sexo}</span>` : ''
  div.innerHTML = `<strong>${nome(pessoa)}</strong>${sexo}${nascimento}${falecimento}${pessoa.cidadeNatal ? `<span>Natural de ${pessoa.cidadeNatal}</span>` : ''}${(pessoa.cidadeAtual || pessoa.cidade) ? `<span>Atual: ${pessoa.cidadeAtual || pessoa.cidade}</span>` : ''}`
  return div
}

function criarCartao(nucleo) {
  const artigo = document.createElement('article')
  artigo.className = `nucleo${nucleo.parceiros.length === 1 ? ' solteiro' : ''}`
  artigo.dataset.id = nucleo.id
  artigo.style.borderColor = nucleo.cor
  const titulo = document.createElement('div')
  titulo.className = 'nucleo-titulo'
  titulo.style.color = nucleo.cor
  titulo.style.borderBottomColor = nucleo.cor
  titulo.textContent = nucleo.parceiros.length > 1 ? 'Casal' : 'Pessoa'
  const membros = document.createElement('div')
  membros.className = 'membros'
  nucleo.parceiros.forEach(pessoa => membros.append(criarMembro(pessoa)))
  artigo.append(titulo, membros)
  return artigo
}

function criarPath(d, cor) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', cor)
  path.setAttribute('stroke-width', '2.5')
  path.setAttribute('stroke-linejoin', 'round')
  path.setAttribute('stroke-linecap', 'round')
  svg.append(path)
}

function desenharLinhas() {
  svg.innerHTML = ''
  const canvasRect = canvas.getBoundingClientRect()
  const membros = new Map([...document.querySelectorAll('.membro')].map(el => [el.dataset.pessoaId, el]))
  const nucleosEl = new Map([...document.querySelectorAll('.nucleo')].map(el => [el.dataset.id, el]))
  const grupos = new Map()

  nucleosVisiveis.forEach(nucleo => {
    nucleo.ligacoesPais.forEach(ligacao => {
      if (!grupos.has(ligacao.paiNucleoId)) grupos.set(ligacao.paiNucleoId, new Map())
      grupos.get(ligacao.paiNucleoId).set(`${ligacao.paiNucleoId}->${ligacao.filhoPessoaId}`, ligacao)
    })
  })

  ;[...grupos.entries()].forEach(([paiNucleoId, ligacoes]) => {
    const paiNucleo = nucleosVisiveis.find(nucleo => nucleo.id === paiNucleoId)
    const paiEl = nucleosEl.get(paiNucleoId)
    if (!paiEl || !paiNucleo) return
    const paiRect = paiEl.getBoundingClientRect()
    const origemX = paiRect.left + paiRect.width / 2 - canvasRect.left
    const origemY = paiRect.bottom - canvasRect.top
    const destinos = [...ligacoes.values()].map(ligacao => {
      const el = membros.get(ligacao.filhoPessoaId)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return {x: rect.left + rect.width / 2 - canvasRect.left, y: rect.top - canvasRect.top}
    }).filter(Boolean)
    if (!destinos.length) return

    const destinoY = Math.min(...destinos.map(destino => destino.y))
    if (destinoY <= origemY) return
    const corredorY = origemY + Math.max(28, Math.min(72, (destinoY - origemY) * 0.45))
    const minX = Math.min(origemX, ...destinos.map(destino => destino.x))
    const maxX = Math.max(origemX, ...destinos.map(destino => destino.x))
    criarPath(`M ${origemX} ${origemY} V ${corredorY}`, paiNucleo.cor)
    if (maxX > minX) criarPath(`M ${minX} ${corredorY} H ${maxX}`, paiNucleo.cor)
    destinos.forEach(destino => criarPath(`M ${destino.x} ${corredorY} V ${destino.y}`, paiNucleo.cor))
  })
}

function ordenarPorBarycentro(grupos) {
  const posicoes = new Map()
  grupos.forEach(lista => lista.forEach((nucleo, indice) => posicoes.set(nucleo.id, indice)))
  for (let rodada = 0; rodada < 8; rodada++) {
    for (let geracao = 1; geracao < grupos.length; geracao++) {
      grupos[geracao].sort((a, b) => {
        const media = nucleo => {
          const valores = [...nucleo.pais].map(id => posicoes.get(id)).filter(valor => valor !== undefined)
          return valores.length ? valores.reduce((soma, valor) => soma + valor, 0) / valores.length : Number.MAX_SAFE_INTEGER
        }
        return media(a) - media(b) || nome(a.parceiros[0]).localeCompare(nome(b.parceiros[0]))
      })
      grupos[geracao].forEach((nucleo, indice) => posicoes.set(nucleo.id, indice))
    }
    for (let geracao = grupos.length - 2; geracao >= 0; geracao--) {
      grupos[geracao].sort((a, b) => {
        const media = nucleo => {
          const valores = [...nucleo.filhos].map(id => posicoes.get(id)).filter(valor => valor !== undefined)
          return valores.length ? valores.reduce((soma, valor) => soma + valor, 0) / valores.length : Number.MAX_SAFE_INTEGER
        }
        return media(a) - media(b) || nome(a.parceiros[0]).localeCompare(nome(b.parceiros[0]))
      })
      grupos[geracao].forEach((nucleo, indice) => posicoes.set(nucleo.id, indice))
    }
  }
  return grupos
}

function renderizar() {
  geracoesEl.innerHTML = ''
  const base = criarNucleos()
  nucleosVisiveis = filtrarComponente(base)
  calcularGeracoes(nucleosVisiveis)
  const maxGeracao = nucleosVisiveis.length ? Math.max(...nucleosVisiveis.map(nucleo => nucleo.geracao)) : 0
  const grupos = Array.from({length: maxGeracao + 1}, (_, geracao) => nucleosVisiveis.filter(nucleo => nucleo.geracao === geracao))
  ordenarPorBarycentro(grupos)

  grupos.forEach(lista => {
    const linha = document.createElement('section')
    linha.className = 'geracao'
    lista.forEach(nucleo => linha.append(criarCartao(nucleo)))
    if (linha.children.length) geracoesEl.append(linha)
  })

  if (!geracoesEl.children.length) geracoesEl.innerHTML = '<div class="aviso">Ainda não há vínculos suficientes para desenhar a árvore.</div>'
  statusEl.textContent = `${pessoas.length} pessoa(s) cadastrada(s)`
  requestAnimationFrame(desenharLinhas)
}

auth.onAuthStateChanged(async usuario => {
  if (!usuario) {
    location.href = '/'
    return
  }
  try {
    const resultado = await db.collection('pessoas').orderBy('nome').get()
    pessoas = resultado.docs.map(documento => ({id: documento.id, ...documento.data()}))
    pessoas.forEach(pessoa => {
      const opcao = document.createElement('option')
      opcao.value = pessoa.id
      opcao.textContent = nome(pessoa)
      foco.append(opcao)
    })
    renderizar()
  } catch {
    statusEl.textContent = 'Erro ao carregar a árvore.'
  }
})

foco.addEventListener('change', renderizar)
window.addEventListener('resize', () => requestAnimationFrame(desenharLinhas))
document.querySelector('#sair').addEventListener('click', async () => {
  await auth.signOut()
  location.href = '/'
})
document.querySelector('#imprimir').addEventListener('click', () => window.print())
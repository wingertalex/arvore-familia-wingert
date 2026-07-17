const auth = firebase.auth()
const db = firebase.firestore()
const canvas = document.querySelector('#canvas')
const geracoesEl = document.querySelector('#geracoes')
const svg = document.querySelector('#linhas')
const statusEl = document.querySelector('#status')
const foco = document.querySelector('#foco')
let pessoas = []
let nucleosVisiveis = []

const nome = pessoa => pessoa ? `${pessoa.nome} ${pessoa.sobrenome}` : 'Não informado'
const dataBR = data => data ? data.split('-').reverse().join('/') : ''
const porId = id => pessoas.find(pessoa => pessoa.id === id)
const chavePar = (a, b) => [a, b].filter(Boolean).sort().join('|')

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
    const nucleo = {id: chave, parceiros, pais: new Set(), filhos: new Set(), ligacoesPais: [], geracao: 0}
    nucleos.push(nucleo)
    parceiros.forEach(pessoa => {
      usados.add(pessoa.id)
      pessoaParaNucleo.set(pessoa.id, nucleo)
    })
  })

  pessoas.forEach(pessoa => {
    if (usados.has(pessoa.id)) return
    const nucleo = {id: pessoa.id, parceiros: [pessoa], pais: new Set(), filhos: new Set(), ligacoesPais: [], geracao: 0}
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
        nucleo.ligacoesPais.push({
          paiNucleoId: paiNucleo.id,
          filhoPessoaId: filho.id,
        })
      })
    })
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
  for (let tentativa = 0; tentativa < nucleos.length + 3; tentativa++) {
    let mudou = false
    nucleos.forEach(nucleo => {
      const pais = [...nucleo.pais].map(id => mapa.get(id)).filter(Boolean)
      const nova = pais.length ? Math.max(...pais.map(pai => pai.geracao)) + 1 : 0
      if (nova !== nucleo.geracao) {
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
  div.innerHTML = `<strong>${nome(pessoa)}</strong>${pessoa.nascimento ? `<span>Nasc. ${dataBR(pessoa.nascimento)}</span>` : ''}${pessoa.cidadeNatal ? `<span>Natural de ${pessoa.cidadeNatal}</span>` : ''}${(pessoa.cidadeAtual || pessoa.cidade) ? `<span>Atual: ${pessoa.cidadeAtual || pessoa.cidade}</span>` : ''}`
  return div
}

function criarCartao(nucleo) {
  const artigo = document.createElement('article')
  artigo.className = `nucleo${nucleo.parceiros.length === 1 ? ' solteiro' : ''}`
  artigo.dataset.id = nucleo.id
  const titulo = document.createElement('div')
  titulo.className = 'nucleo-titulo'
  titulo.textContent = nucleo.parceiros.length > 1 ? 'Casal' : 'Pessoa'
  const membros = document.createElement('div')
  membros.className = 'membros'
  nucleo.parceiros.forEach(pessoa => membros.append(criarMembro(pessoa)))
  artigo.append(titulo, membros)
  return artigo
}

function desenharLinhas() {
  svg.innerHTML = ''
  const canvasRect = canvas.getBoundingClientRect()
  const membros = new Map([...document.querySelectorAll('.membro')].map(elemento => [elemento.dataset.pessoaId, elemento]))
  const nucleosEl = new Map([...document.querySelectorAll('.nucleo')].map(elemento => [elemento.dataset.id, elemento]))

  nucleosVisiveis.forEach(nucleo => {
    const ligacoesUnicas = new Map()

    nucleo.ligacoesPais.forEach(ligacao => {
      const chave = `${ligacao.paiNucleoId}->${ligacao.filhoPessoaId}`
      ligacoesUnicas.set(chave, ligacao)
    })

    ligacoesUnicas.forEach(ligacao => {
      const paiEl = nucleosEl.get(ligacao.paiNucleoId)
      const filhoEl = membros.get(ligacao.filhoPessoaId)
      if (!paiEl || !filhoEl) return

      const pai = paiEl.getBoundingClientRect()
      const filho = filhoEl.getBoundingClientRect()
      const origemX = pai.left + pai.width / 2 - canvasRect.left
      const origemY = pai.bottom - canvasRect.top
      const destinoX = filho.left + filho.width / 2 - canvasRect.left
      const destinoY = filho.top - canvasRect.top
      const meioY = origemY + (destinoY - origemY) * 0.52

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M ${origemX} ${origemY} V ${meioY} H ${destinoX} V ${destinoY}`)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', '#789084')
      path.setAttribute('stroke-width', '2')
      path.setAttribute('stroke-linejoin', 'round')
      path.setAttribute('stroke-linecap', 'round')
      svg.append(path)
    })
  })
}

function renderizar() {
  geracoesEl.innerHTML = ''
  const base = criarNucleos()
  nucleosVisiveis = filtrarComponente(base)
  calcularGeracoes(nucleosVisiveis)
  const maxGeracao = nucleosVisiveis.length ? Math.max(...nucleosVisiveis.map(nucleo => nucleo.geracao)) : 0

  for (let geracao = 0; geracao <= maxGeracao; geracao++) {
    const linha = document.createElement('section')
    linha.className = 'geracao'
    nucleosVisiveis
      .filter(nucleo => nucleo.geracao === geracao)
      .sort((a, b) => nome(a.parceiros[0]).localeCompare(nome(b.parceiros[0])))
      .forEach(nucleo => linha.append(criarCartao(nucleo)))
    if (linha.children.length) geracoesEl.append(linha)
  }

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

import React, {useEffect, useMemo, useState} from 'react'
import ReactDOM from 'react-dom/client'
import {collection, onSnapshot, orderBy, query} from 'firebase/firestore'
import {db} from './firebase'
import './public-tree.css'

type Pessoa = {
  id:string
  nome:string
  sobrenome:string
  nascimento?:string
  falecimento?:string
  viva?:boolean
  paiId?:string
  maeId?:string
  conjugeId?:string
}

const nomeCompleto=(p?:Pessoa)=>p?`${p.nome} ${p.sobrenome}`:'Não informado'
const dataBR=(d?:string)=>{if(!d)return'';const[a,m,dia]=d.split('-');return a&&m&&dia?`${dia}/${m}/${a}`:d}

function ArvorePublica(){
  const[pessoas,setPessoas]=useState<Pessoa[]>([])
  const[busca,setBusca]=useState('')
  const[erro,setErro]=useState('')

  useEffect(()=>{
    const q=query(collection(db,'pessoas'),orderBy('nome'))
    return onSnapshot(q,s=>setPessoas(s.docs.map(d=>({id:d.id,...d.data()} as Pessoa))),()=>setErro('Não foi possível carregar a árvore no momento.'))
  },[])

  const porId=(id?:string)=>pessoas.find(p=>p.id===id)
  const resultado=useMemo(()=>{
    const termo=busca.trim().toLocaleLowerCase('pt-BR')
    if(!termo)return pessoas
    return pessoas.filter(p=>nomeCompleto(p).toLocaleLowerCase('pt-BR').includes(termo))
  },[busca,pessoas])

  return <main className="public-tree-page">
    <header className="public-tree-header">
      <a href="/" className="brand">Raízes Wingert</a>
      <div>
        <h1>Árvore genealógica</h1>
        <p>Visualização pública, sem opções de cadastro, edição ou exclusão.</p>
      </div>
      <a href="/cadastro.html" className="admin-link">Área de cadastro</a>
    </header>

    <section className="toolbar">
      <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar uma pessoa..." aria-label="Pesquisar pessoa"/>
      <span>{resultado.length} pessoa(s)</span>
    </section>

    {erro&&<p className="erro">{erro}</p>}

    <section className="people-grid">
      {resultado.map(p=>{
        const pai=porId(p.paiId),mae=porId(p.maeId),conjuge=porId(p.conjugeId)
        const filhos=pessoas.filter(f=>f.paiId===p.id||f.maeId===p.id)
        return <article className="person-card" key={p.id}>
          <h2>{nomeCompleto(p)}</h2>
          <p className="dates">{p.nascimento?`Nascimento: ${dataBR(p.nascimento)}`:'Nascimento não informado'}{!p.viva&&p.falecimento?` · Falecimento: ${dataBR(p.falecimento)}`:''}</p>
          <dl>
            {(pai||mae)&&<><dt>Pais</dt><dd>{pai?nomeCompleto(pai):'Não informado'} / {mae?nomeCompleto(mae):'Não informada'}</dd></>}
            {conjuge&&<><dt>Cônjuge</dt><dd>{nomeCompleto(conjuge)}</dd></>}
            {filhos.length>0&&<><dt>Filhos</dt><dd>{filhos.map(nomeCompleto).join(', ')}</dd></>}
          </dl>
        </article>
      })}
    </section>
  </main>
}

ReactDOM.createRoot(document.getElementById('public-tree-root')!).render(<React.StrictMode><ArvorePublica/></React.StrictMode>)

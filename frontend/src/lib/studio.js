// Valores de personalización compartidos entre el editor del tallerista y su página pública.
export const accentHex={terracota:'#c65c38',oliva:'#76905e',azul:'#648eaf',ciruela:'#7d4b6a',noche:'#2f3e5c'}
export const accentNames={terracota:'Terracota',oliva:'Oliva',azul:'Azul suave',ciruela:'Ciruela',noche:'Azul noche'}
export const fontStacks={moderna:"'Inter','Segoe UI',system-ui,sans-serif",clasica:"Georgia,'Times New Roman',serif",redondeada:"'Nunito','Trebuchet MS',system-ui,sans-serif",manuscrita:"'Segoe Print','Comic Sans MS','Bradley Hand',cursive"}
export const fontNames={moderna:'Moderna',clasica:'Clásica (serif)',redondeada:'Redondeada',manuscrita:'Manuscrita'}
export const layoutNames={portada:'Portada grande',compacta:'Compacta',galeria:'Galería primero'}
export const linkNames={web:'Sitio web',instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',whatsapp:'WhatsApp (wa.me)'}
// Cuestionario de estética: cada respuesta propone una combinación que el tallerista puede ajustar.
export const styleQuiz=[
  {id:'artesanal',label:'Cálido y artesanal',hint:'barro, madera, hecho a mano',set:{accent:'terracota',font:'redondeada',layout:'portada'}},
  {id:'clasico',label:'Elegante y clásico',hint:'academia, música, escritura',set:{accent:'noche',font:'clasica',layout:'compacta'}},
  {id:'natural',label:'Natural y sereno',hint:'bienestar, plantas, acuarela',set:{accent:'oliva',font:'moderna',layout:'galeria'}},
  {id:'creativo',label:'Juvenil y creativo',hint:'arte urbano, teatro, ilustración',set:{accent:'ciruela',font:'manuscrita',layout:'galeria'}},
]
export const studioColor=(studio)=>studio?.accentColor||accentHex[studio?.accent]||accentHex.terracota

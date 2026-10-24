// @ts-nocheck
/* Modo demonstração: porta simplificada do pipeline (guardrails, busca, seleção) que roda no navegador
   SOMENTE quando a API não responde. A fonte da verdade continua sendo o backend FastAPI. */
import type { RecommendResponse } from './types';
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CATALOGO = `0001~Hidratante Corporal Pele Seca Ureia 5% 400 ml~Dauf~hidratante-corporal-seca~400 ml~21.9~4.4~410~1~adulto~pele seca|inverno|pele que descasca|ressecamento~seca|muito seca~ureia|glicerina~~0|1
0002~Hidratante Corporal Pele Seca Ceramidas 400 ml~Aurora Derm~hidratante-corporal-seca~400 ml~42.9~4.7~760~0~adulto~pele seca|inverno|pele que descasca|ressecamento|pele sensível~seca|muito seca|sensível~ceramidas|glicerina~~0|1
0003~Hidratante Corporal Pele Seca Ureia 10% 200 ml~Vitalle~hidratante-corporal-seca~200 ml~34.9~4.6~380~0~adulto~pele seca|inverno|pele que descasca|ressecamento|pele muito seca~seca|muito seca~ureia~~0|1
0004~Hidratante Corporal Pele Seca Karité e Aveia 400 ml~Naturalis~hidratante-corporal-seca~400 ml~27.9~4.3~190~0~adulto~pele seca|inverno|pele que descasca|ressecamento~seca|muito seca~karité|aveia~~0|1
0005~Hidratante Corporal Pele Seca Hidratação Intensa 500 ml~HidraMais~hidratante-corporal-seca~500 ml~18.5~4.1~540~0~adulto~pele seca|inverno|pele que descasca|ressecamento~seca|muito seca~glicerina|óleo de amêndoas~~0|1
0006~Hidratante Corporal Uso Diário Vitamina E 400 ml~Dauf~hidratante-corporal-diario~400 ml~15.9~4.3~620~1~adulto~hidratação diária|pele normal|rotina de banho~normal|mista|seca~glicerina|vitamina E~~0
0007~Hidratante Corporal Uso Diário Aloe Vera 300 ml~Brisa~hidratante-corporal-diario~300 ml~19.9~4.2~260~0~adulto~hidratação diária|pele normal|rotina de banho~normal|mista|seca~aloe vera|glicerina~~0
0008~Hidratante Corporal Uso Diário Absorção Rápida 400 ml~Lumina~hidratante-corporal-diario~400 ml~24.9~4.5~330~0~adulto~hidratação diária|pele normal|rotina de banho|toque seco|pele oleosa~normal|mista|oleosa~glicerina|pantenol~~0
0009~Hidratante Corporal Uso Diário Manteiga de Cacau 400 ml~Naturalis~hidratante-corporal-diario~400 ml~26.9~4.4~150~0~adulto~hidratação diária|pele normal|rotina de banho~normal|mista|seca~manteiga de cacau~~0
0010~Hidratante Facial Gel-Creme Hidratante 50 g~Dauf~hidratante-facial~50 g~19.9~4.2~310~1~adulto~hidratação do rosto|rotina facial|pele seca~normal|mista|oleosa~glicerina|pantenol~Recomenda-se protetor solar durante o dia em rotinas faciais~0|2
0011~Hidratante Facial Ácido Hialurônico 50 g~Aurora Derm~hidratante-facial~50 g~69.9~4.7~820~0~adulto~hidratação do rosto|rotina facial|pele seca|pele desidratada~seca|normal|mista~ácido hialurônico|glicerina~Recomenda-se protetor solar durante o dia em rotinas faciais~0|2
0012~Hidratante Facial Oil Free 50 g~ClearSkin~hidratante-facial~50 g~44.9~4.5~540~0~adulto~hidratação do rosto|rotina facial|pele seca|pele oleosa|oil free~oleosa|mista~niacinamida|glicerina~Recomenda-se protetor solar durante o dia em rotinas faciais~0|2
0013~Hidratante Facial Ceramidas Pele Sensível 50 g~DermaVida~hidratante-facial~50 g~74.9~4.8~410~0~adulto~hidratação do rosto|rotina facial|pele seca|pele sensível~seca|sensível~ceramidas|pantenol~Recomenda-se protetor solar durante o dia em rotinas faciais~0|2
0014~Hidratante Facial Creme Noturno 50 g~Lumina~hidratante-facial~50 g~39.9~4.3~220~0~adulto~hidratação do rosto|rotina facial|pele seca|uso noturno~seca|normal~glicerina|vitamina E~Recomenda-se protetor solar durante o dia em rotinas faciais~0|2
0015~Protetor Solar Facial FPS 50 Oil Free 50 g~Dauf~protetor-solar-facial~50 g~29.9~4.5~820~1~adulto~proteção solar|uso diário|rosto|oil free|pele oleosa~oleosa|mista|normal~filtros UVA/UVB~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0016~Protetor Solar Facial FPS 30 Hidratante 50 g~Dauf~protetor-solar-facial~50 g~24.9~4.3~450~1~adulto~proteção solar|uso diário|rosto|pele seca|hidratante~seca|normal~filtros UVA/UVB|glicerina~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0017~Protetor Solar Facial FPS 60 Toque Seco 50 g~Aurora Derm~protetor-solar-facial~50 g~79.9~4.8~900~0~adulto~proteção solar|uso diário|rosto|toque seco|pele mista~mista|oleosa|normal~filtros UVA/UVB~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0018~Protetor Solar Facial FPS 50 Pele Oleosa 40 g~ClearSkin~protetor-solar-facial~40 g~54.9~4.5~600~0~adulto~proteção solar|uso diário|rosto|pele oleosa~oleosa~filtros UVA/UVB|niacinamida~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0019~Protetor Solar Facial FPS 70 Antioxidante 50 g~Solare~protetor-solar-facial~50 g~64.9~4.6~330~0~adulto~proteção solar|uso diário|rosto|antioxidante~normal|mista~filtros UVA/UVB|vitamina C~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0020~Protetor Solar Facial FPS 50 Pele Sensível 50 g~DermaVida~protetor-solar-facial~50 g~89.9~4.7~480~0~adulto~proteção solar|uso diário|rosto|pele sensível~sensível|seca~filtros UVA/UVB|pantenol~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0021~Protetor Solar Corporal FPS 30 Hidratante 200 ml~Dauf~protetor-solar-corporal~200 ml~28.9~4.4~740~1~adulto~proteção solar|praia|piscina|corpo|hidratante~todos~filtros UVA/UVB|glicerina~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0022~Protetor Solar Corporal FPS 50 Oil Free 200 ml~Dauf~protetor-solar-corporal~200 ml~33.9~4.5~650~1~adulto~proteção solar|praia|piscina|corpo|oil free~todos~filtros UVA/UVB~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0023~Protetor Solar Corporal FPS 50 200 ml~Solare~protetor-solar-corporal~200 ml~49.9~4.6~380~0~adulto~proteção solar|praia|piscina|corpo~todos~filtros UVA/UVB~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0024~Protetor Solar Corporal FPS 60 Resistente à Água 120 ml~Brisa~protetor-solar-corporal~120 ml~52.9~4.5~270~0~adulto~proteção solar|praia|piscina|corpo|resistente à água~todos~filtros UVA/UVB~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0025~Protetor Solar Corporal FPS 30 200 ml~Vitalle~protetor-solar-corporal~200 ml~38.9~4.2~210~0~adulto~proteção solar|praia|piscina|corpo~todos~filtros UVA/UVB|vitamina E~Reaplicar conforme orientação da embalagem|Protetor solar não dispensa outras medidas de proteção contra o sol~2
0026~Sabonete Facial Pele Normal 150 ml~Dauf~limpeza-facial~150 ml~14.9~4.3~350~1~adulto~limpeza do rosto|rotina facial|pele normal~normal|seca~glicerina~Recomenda-se protetor solar durante o dia em rotinas faciais~2|3
0027~Sabonete Facial Pele Oleosa 150 ml~Dauf~limpeza-facial~150 ml~15.9~4.4~420~1~adulto~limpeza do rosto|rotina facial|pele oleosa|pele com tendência a acne~oleosa|mista~chá verde|glicerina~Recomenda-se protetor solar durante o dia em rotinas faciais~2|3
0028~Gel de Limpeza Facial Oil Free 150 g~ClearSkin~limpeza-facial~150 g~39.9~4.6~610~0~adulto~limpeza do rosto|rotina facial|pele oleosa~oleosa|mista~niacinamida~Recomenda-se protetor solar durante o dia em rotinas faciais~2|3
0029~Gel de Limpeza Facial Suave 200 ml~Aurora Derm~limpeza-facial~200 ml~58.9~4.7~480~0~adulto~limpeza do rosto|rotina facial|pele sensível~sensível|seca~pantenol~Recomenda-se protetor solar durante o dia em rotinas faciais~2|3
0030~Sabonete Facial Esfoliante 100 g~Vitalle~limpeza-facial~100 g~22.9~4~140~0~adulto~limpeza do rosto|rotina facial|esfoliação suave~normal|mista~esfoliante suave~Recomenda-se protetor solar durante o dia em rotinas faciais~2|3
0031~Água Micelar 200 ml~Dauf~demaquilante~200 ml~19.9~4.4~520~1~adulto~remover maquiagem|limpeza do rosto|água micelar~todos~água micelar~~2|3
0032~Demaquilante Bifásico 100 ml~Dauf~demaquilante~100 ml~17.9~4.2~290~1~adulto~remover maquiagem|limpeza do rosto|água micelar|maquiagem à prova d'água~todos~óleo vegetal|água micelar~~2|3
0033~Água Micelar 400 ml~Lumina~demaquilante~400 ml~34.9~4.5~440~0~adulto~remover maquiagem|limpeza do rosto|água micelar~todos~água micelar~~2|3
0034~Água Micelar Pele Sensível 200 ml~Aurora Derm~demaquilante~200 ml~49.9~4.7~390~0~adulto~remover maquiagem|limpeza do rosto|água micelar|pele sensível~sensível|seca~água micelar~~2|3
0035~Lenços Demaquilantes 25 un~Brisa~demaquilante~25 un~21.9~4.1~230~0~adulto~remover maquiagem|limpeza do rosto|água micelar|praticidade|viagem~todos~água micelar~~2|3
0036~Sérum Facial Vitamina C 10% 30 ml~Aurora Derm~serum~30 ml~89.9~4.6~700~0~adulto~manchas leves|uniformizar o tom|pele opaca|rotina facial~normal|mista~vitamina C~Recomenda-se protetor solar diário em rotinas com séruns para manchas~0|4
0037~Sérum Facial Niacinamida 5% 30 ml~ClearSkin~serum~30 ml~59.9~4.5~620~0~adulto~manchas leves|uniformizar o tom|pele opaca|rotina facial|pele oleosa~oleosa|mista~niacinamida~Recomenda-se protetor solar diário em rotinas com séruns para manchas~0|4
0038~Sérum Facial Vitamina C Antioxidante 30 ml~Lumina~serum~30 ml~49.9~4.2~280~0~adulto~manchas leves|uniformizar o tom|pele opaca|rotina facial~normal|mista~vitamina C|vitamina E~Recomenda-se protetor solar diário em rotinas com séruns para manchas~0|4
0039~Sérum Facial Niacinamida Pele Sensível 30 ml~DermaVida~serum~30 ml~79.9~4.7~350~0~adulto~manchas leves|uniformizar o tom|pele opaca|rotina facial|pele sensível~sensível|normal~niacinamida|pantenol~Recomenda-se protetor solar diário em rotinas com séruns para manchas~0|4
0040~Protetor Labial FPS 15 4,5 g~Dauf~protetor-labial~4,5 g~6.9~4.2~510~1~adulto~lábios ressecados|hidratação labial|frio|proteção solar labial~todos~filtros UVA/UVB|manteiga de karité~~0
0041~Hidratante Labial Cacau 4 g~Brisa~protetor-labial~4 g~9.9~4.3~230~0~adulto~lábios ressecados|hidratação labial|frio~todos~manteiga de cacau~~0
0042~Manteiga Labial 5 g~Verdi~protetor-labial~5 g~12.9~4.5~170~0~adulto~lábios ressecados|hidratação labial|frio~todos~manteiga de karité|óleo de coco~~0
0043~Protetor Labial FPS 30 4,8 g~Solare~protetor-labial~4,8 g~14.9~4.4~200~0~adulto~lábios ressecados|hidratação labial|frio|proteção solar labial~todos~filtros UVA/UVB~~0
0044~Creme para as Mãos Hidratante 60 g~Dauf~hidratante-maos~60 g~7.9~4.1~300~1~adulto~mãos ressecadas|hidratação das mãos|frio~todos~glicerina|vitamina E~~0
0045~Creme para as Mãos Ureia 75 g~Vitalle~hidratante-maos~75 g~18.9~4.6~260~0~adulto~mãos ressecadas|hidratação das mãos|frio|pele muito seca~todos~ureia~~0
0046~Creme para as Mãos Karité 50 g~Naturalis~hidratante-maos~50 g~15.9~4.4~140~0~adulto~mãos ressecadas|hidratação das mãos|frio~todos~karité~~0
0047~Loção Pós-Sol 200 ml~Dauf~pos-sol~200 ml~17.9~4.3~400~1~adulto~pós-sol|pele exposta ao sol|pele quente e ressecada|praia~todos~aloe vera|glicerina~Em caso de bolhas, febre ou dor intensa após exposição ao sol, buscar atendimento médico~0
0048~Gel Pós-Sol Aloe 200 g~Brisa~pos-sol~200 g~24.9~4.4~250~0~adulto~pós-sol|pele exposta ao sol|pele quente e ressecada|praia~todos~aloe vera~Em caso de bolhas, febre ou dor intensa após exposição ao sol, buscar atendimento médico~0
0049~Pós-Sol Calmante 240 ml~Solare~pos-sol~240 ml~29.9~4.5~280~0~adulto~pós-sol|pele exposta ao sol|pele quente e ressecada|praia~todos~aloe vera|pantenol~Em caso de bolhas, febre ou dor intensa após exposição ao sol, buscar atendimento médico~0
0050~Shampoo Uso Diário 350 ml~Dauf~shampoo-diario~350 ml~11.9~4.2~480~1~adulto~limpeza dos cabelos|uso diário|cabelo normal~~~~3
0051~Shampoo Cabelos Normais 300 ml~Brisa~shampoo-diario~300 ml~16.9~4.3~250~0~adulto~limpeza dos cabelos|uso diário|cabelo normal~~~~3
0052~Shampoo Hidratação 350 ml~Naturalis~shampoo-diario~350 ml~21.9~4.5~210~0~adulto~limpeza dos cabelos|uso diário|cabelo normal|cabelo seco~~~~3
0053~Shampoo Suave 400 ml~Verdi~shampoo-diario~400 ml~14.9~4.2~330~0~adulto~limpeza dos cabelos|uso diário|cabelo normal|uso frequente~~~~3
0054~Shampoo Anticaspa Zinco 200 ml~Vitalle~shampoo-anticaspa~200 ml~24.9~4.4~380~0~adulto~caspa|couro cabeludo com descamação|couro cabeludo oleoso~~piritionato de zinco~~3|2
0055~Shampoo Anticaspa Uso Frequente 350 ml~Dauf~shampoo-anticaspa~350 ml~15.9~4.1~360~1~adulto~caspa|couro cabeludo com descamação|couro cabeludo oleoso~~piritionato de zinco~~3|2
0056~Shampoo Anticaspa Controle de Oleosidade 300 ml~ClearSkin~shampoo-anticaspa~300 ml~29.9~4.5~290~0~adulto~caspa|couro cabeludo com descamação|couro cabeludo oleoso|cabelo oleoso~~piritionato de zinco~~3|2
0057~Shampoo Anticaspa Menta 350 ml~Brisa~shampoo-anticaspa~350 ml~19.9~4.2~240~0~adulto~caspa|couro cabeludo com descamação|couro cabeludo oleoso~~piritionato de zinco|mentol~~3|2
0058~Condicionador Hidratação 350 ml~Dauf~condicionador~350 ml~12.9~4.2~420~1~adulto~desembaraçar|maciez|uso diário~~~~3
0059~Condicionador Cabelos Normais 300 ml~Brisa~condicionador~300 ml~17.9~4.3~230~0~adulto~desembaraçar|maciez|uso diário~~~~3
0060~Condicionador Nutrição 350 ml~Naturalis~condicionador~350 ml~22.9~4.5~200~0~adulto~desembaraçar|maciez|uso diário|cabelo seco|frizz~~~~3
0061~Condicionador Suave 400 ml~Verdi~condicionador~400 ml~15.9~4.2~310~0~adulto~desembaraçar|maciez|uso diário~~~~3
0062~Máscara Capilar Hidratação Profunda 300 g~Aurora Derm~mascara-capilar~300 g~49.9~4.7~340~0~adulto~hidratação profunda|nutrição|cabelo ressecado|frizz~~~~3
0063~Máscara Capilar Nutrição 250 g~Naturalis~mascara-capilar~250 g~29.9~4.4~180~0~adulto~hidratação profunda|nutrição|cabelo ressecado|frizz~~~~3
0064~Máscara Capilar Reconstrução 300 g~Lumina~mascara-capilar~300 g~34.9~4.5~220~0~adulto~hidratação profunda|nutrição|cabelo ressecado|frizz~~~~3
0065~Máscara Capilar Hidratação 300 g~Dauf~mascara-capilar~300 g~19.9~4.1~260~1~adulto~hidratação profunda|nutrição|cabelo ressecado|frizz~~~~3
0066~Creme de Pentear para Cachos 300 ml~Verdi~cachos~300 ml~24.9~4.5~360~0~adulto~cabelos cacheados|definição de cachos|frizz~~~~3
0067~Ativador de Cachos 250 ml~Naturalis~cachos~250 ml~31.9~4.6~240~0~adulto~cabelos cacheados|definição de cachos|frizz~~~~3
0068~Gelatina para Definição de Cachos 300 g~Brisa~cachos~300 g~19.9~4.2~190~0~adulto~cabelos cacheados|definição de cachos|frizz~~~~3
0069~Leave-in Protetor Térmico 200 ml~Lumina~leave-in~200 ml~27.9~4.4~300~0~adulto~proteção térmica|frizz|finalização|hidratação sem enxágue~~~~3
0070~Leave-in Hidratante 200 ml~Dauf~leave-in~200 ml~14.9~4~250~1~adulto~proteção térmica|frizz|finalização|hidratação sem enxágue~~~~3
0071~Sérum Capilar 60 ml~Aurora Derm~leave-in~60 ml~54.9~4.7~330~0~adulto~proteção térmica|frizz|finalização|hidratação sem enxágue~~~~3
0072~Creme Dental Menta 90 g~Dauf~creme-dental~90 g~3.9~4.2~900~1~adulto~higiene bucal|proteção contra cáries|hálito fresco~~flúor~~5
0073~Creme Dental Branqueador 90 g~Sorriso Pleno~creme-dental~90 g~11.9~4.3~410~0~adulto~higiene bucal|proteção contra cáries|hálito fresco|branqueamento~~flúor~~5
0074~Creme Dental Dentes Sensíveis 90 g~Sorriso Pleno~creme-dental~90 g~14.9~4.5~360~0~adulto~higiene bucal|proteção contra cáries|hálito fresco|dentes sensíveis~~flúor~~5
0075~Creme Dental Proteção Total 90 g~Cuide+~creme-dental~90 g~7.9~4.3~520~0~adulto~higiene bucal|proteção contra cáries|hálito fresco~~flúor~~5
0076~Escova Dental Macia 1 un~Dauf~escova-dental~1 un~5.9~4.1~600~1~adulto~higiene bucal|escovação diária~~~~
0077~Escova Dental Extramacia 2 un~Sorriso Pleno~escova-dental~2 un~14.9~4.5~330~0~adulto~higiene bucal|escovação diária|gengiva sensível~~~~
0078~Escova Dental Bambu 1 un~Cuide+~escova-dental~1 un~12.9~4.2~150~0~adulto~higiene bucal|escovação diária|sustentável~~~~
0079~Fio Dental 50 m~Dauf~fio-dental~50 m~4.9~4.1~540~1~adulto~higiene bucal|limpeza entre os dentes~~~~
0080~Fio Dental Encerado 100 m~Sorriso Pleno~fio-dental~100 m~9.9~4.4~280~0~adulto~higiene bucal|limpeza entre os dentes~~~~
0081~Fita Dental 50 m~Cuide+~fio-dental~50 m~7.9~4.3~190~0~adulto~higiene bucal|limpeza entre os dentes~~~~
0082~Enxaguante Bucal Sem Álcool 500 ml~Dauf~enxaguante-bucal~500 ml~12.9~4.2~330~1~adulto~higiene bucal|hálito fresco|cuidado com a gengiva|sem álcool~~~~6|5
0083~Enxaguante Bucal Proteção da Gengiva 500 ml~Sorriso Pleno~enxaguante-bucal~500 ml~21.9~4.5~270~0~adulto~higiene bucal|hálito fresco|cuidado com a gengiva~~~~6|5
0084~Enxaguante Bucal Menta 500 ml~Cuide+~enxaguante-bucal~500 ml~14.9~4.2~210~0~adulto~higiene bucal|hálito fresco|cuidado com a gengiva~~~~6|5
0085~Sabonete Líquido Corporal Hidratante 250 ml~Dauf~sabonete-liquido~250 ml~8.9~4.2~450~1~adulto~banho|limpeza corporal|higiene diária~todos~~~0
0086~Sabonete Líquido Corporal Hidratante 300 ml~Brisa~sabonete-liquido~300 ml~14.9~4.3~240~0~adulto~banho|limpeza corporal|higiene diária~todos~~~0
0087~Sabonete Líquido Corporal Aveia 250 ml~Naturalis~sabonete-liquido~250 ml~16.9~4.5~160~0~adulto~banho|limpeza corporal|higiene diária|pele sensível|pele seca~sensível|seca~aveia~~0
0088~Sabonete Líquido Corporal Neutro 300 ml~Verdi~sabonete-liquido~300 ml~11.9~4.2~210~0~adulto~banho|limpeza corporal|higiene diária|pele sensível~todos~~~0
0089~Sabonete em Barra Hidratante 4 x 85 g~Dauf~sabonete-barra~4 x 85 g~9.9~4.2~380~1~adulto~banho|limpeza corporal|higiene diária~todos~~~0
0090~Sabonete em Barra Glicerinado 90 g~Brisa~sabonete-barra~90 g~4.9~4.3~220~0~adulto~banho|limpeza corporal|higiene diária~todos~~~0
0091~Sabonete em Barra Argila 90 g~Naturalis~sabonete-barra~90 g~6.9~4.4~130~0~adulto~banho|limpeza corporal|higiene diária|pele oleosa~todos~argila~~0
0092~Desodorante Aerossol 150 ml~Dauf~desodorante~150 ml~12.9~4.2~560~1~adulto~desodorante|higiene diária|transpiração~todos~~~2
0093~Desodorante Roll-on 50 ml~Dauf~desodorante~50 ml~9.9~4.1~340~1~adulto~desodorante|higiene diária|transpiração~todos~~~2
0094~Desodorante Antitranspirante Sem Perfume 90 ml~Brisa~desodorante~90 ml~17.9~4.5~180~0~adulto~desodorante|higiene diária|transpiração|pele sensível|sem perfume~todos~~~2
0095~Desodorante Antitranspirante 48h 150 ml~Vitalle~desodorante~150 ml~19.9~4.4~290~0~adulto~desodorante|higiene diária|transpiração|proteção prolongada~todos~~~2
0096~Depilação Depil Cera Fria Corporal 100 g~Dauf~depilacao~100 g~15.9~4.1~260~1~adulto~depilação|remoção de pelos|depilação com cera~todos~~Fazer teste prévio em pequena área da pele~0|2
0097~Depilação Depil Creme Depilatório 100 g~Dauf~depilacao~100 g~12.9~4~220~1~adulto~depilação|remoção de pelos|depilação com creme~todos~~Fazer teste prévio em pequena área da pele~0|2
0098~Depilação Lâmina de Barbear Descartável 4 un~Brisa~depilacao~4 un~9.9~4.2~310~0~adulto~depilação|remoção de pelos|barbear~todos~~Fazer teste prévio em pequena área da pele~0|2
0099~Depilação Aparelho de Barbear 3 Lâminas 2 un~Cuide+~depilacao~2 un~15.9~4.4~280~0~adulto~depilação|remoção de pelos|barbear~todos~~Fazer teste prévio em pequena área da pele~0|2
0100~Absorvente com Abas 16 un~Dauf~absorvente~16 un~4.5~4.2~420~1~adulto~higiene íntima|ciclo menstrual|proteção diária~~~~
0101~Absorvente Noturno 8 un~Brisa~absorvente~8 un~7.9~4.4~250~0~adulto~higiene íntima|ciclo menstrual|proteção diária|uso noturno~~~~
0102~Protetor Diário 40 un~Cuide+~absorvente~40 un~8.9~4.3~200~0~adulto~higiene íntima|ciclo menstrual|proteção diária|proteção diária~~~~
0103~Sabonete Líquido Infantil Sem Lágrimas 200 ml~Kidz Care~sabonete-infantil~200 ml~14.9~4.7~480~0~infantil~banho do bebê|higiene infantil|pele sensível~sensível~~~0
0104~Sabonete Líquido Infantil Infantil 200 ml~Dauf~sabonete-infantil~200 ml~8.9~4.2~300~1~infantil~banho do bebê|higiene infantil|pele sensível~sensível~~~0
0105~Sabonete Líquido Infantil Neutro Bebê 150 ml~Nuvem~sabonete-infantil~150 ml~12.9~4.6~260~0~infantil~banho do bebê|higiene infantil|pele sensível~sensível~~~0
0106~Shampoo Infantil Sem Lágrimas 200 ml~Kidz Care~shampoo-infantil~200 ml~15.9~4.7~450~0~infantil~banho do bebê|cabelo infantil|sem lágrimas~~~~3
0107~Shampoo Infantil Suave Bebê 200 ml~Nuvem~shampoo-infantil~200 ml~13.9~4.6~230~0~infantil~banho do bebê|cabelo infantil|sem lágrimas~~~~3
0108~Shampoo Infantil Infantil 200 ml~Dauf~shampoo-infantil~200 ml~9.9~4.2~280~1~infantil~banho do bebê|cabelo infantil|sem lágrimas~~~~3
0109~Loção Hidratante Bebê 200 ml~Kidz Care~hidratante-infantil~200 ml~19.9~4.7~400~0~infantil~hidratação do bebê|pele sensível|pele seca infantil~sensível|seca~glicerina~~0
0110~Creme Pele Sensível 200 g~Nuvem~hidratante-infantil~200 g~24.9~4.8~220~0~infantil~hidratação do bebê|pele sensível|pele seca infantil~sensível|seca~pantenol|glicerina~~0
0111~Loção Hidratante Infantil 200 ml~Dauf~hidratante-infantil~200 ml~11.9~4.2~310~1~infantil~hidratação do bebê|pele sensível|pele seca infantil~sensível|seca~glicerina~~0
0112~Lenço Umedecido Sem Perfume 100 un~Kidz Care~lenco-umedecido~100 un~14.9~4.6~520~0~infantil~troca de fraldas|limpeza prática|higiene infantil~sensível~~~2
0113~Lenço Umedecido Hipoalergênico 80 un~Nuvem~lenco-umedecido~80 un~10.9~4.5~300~0~infantil~troca de fraldas|limpeza prática|higiene infantil|hipoalergênico~sensível~~~2
0114~Lenço Umedecido Lenço Umedecido 100 un~Dauf~lenco-umedecido~100 un~9.9~4.2~410~1~infantil~troca de fraldas|limpeza prática|higiene infantil~sensível~~~2
0115~Protetor Solar Infantil FPS 50 120 ml~Kidz Care~protetor-solar-infantil~120 ml~49.9~4.7~330~0~infantil~proteção solar infantil|praia|piscina~sensível~filtros UVA/UVB~Reaplicar conforme orientação da embalagem|Verificar a faixa etária indicada na embalagem~2
0116~Protetor Solar Infantil Kids FPS 50 120 ml~Dauf~protetor-solar-infantil~120 ml~29.9~4.4~360~1~infantil~proteção solar infantil|praia|piscina~sensível~filtros UVA/UVB~Reaplicar conforme orientação da embalagem|Verificar a faixa etária indicada na embalagem~2
0117~Protetor Solar Infantil Kids FPS 60 120 ml~Solare~protetor-solar-infantil~120 ml~44.9~4.6~240~0~infantil~proteção solar infantil|praia|piscina~sensível~filtros UVA/UVB~Reaplicar conforme orientação da embalagem|Verificar a faixa etária indicada na embalagem~2
0118~Hastes Flexíveis 150 un~Dauf~hastes-flexiveis~150 un~3.9~4.2~480~1~todos~higiene externa das orelhas|uso geral~~~Uso apenas na parte externa~
0119~Hastes Flexíveis Bebê 75 un~Nuvem~hastes-flexiveis~75 un~5.9~4.4~160~0~infantil~higiene externa das orelhas|uso geral~~~Uso apenas na parte externa~
0120~Gel Dental Infantil 50 g~Sorriso Pleno~creme-dental-infantil~50 g~9.9~4.5~280~0~infantil~higiene bucal infantil|primeiros dentes~~flúor~Supervisão de um adulto durante a escovação~5
0121~Creme Dental Infantil Frutas 50 g~Kidz Care~creme-dental-infantil~50 g~8.9~4.4~230~0~infantil~higiene bucal infantil|primeiros dentes~~flúor~Supervisão de um adulto durante a escovação~5
0122~Repelente de Insetos Loção 100 ml~Dauf~repelente~100 ml~12.9~4.1~380~1~adulto~repelente de insetos|mosquitos|viagem|trilha|áreas externas~~ativo repelente~Seguir a faixa etária e as instruções da embalagem~7|8
0123~Repelente de Insetos Icaridina 100 ml~Verdi~repelente~100 ml~29.9~4.6~700~0~adulto~repelente de insetos|mosquitos|viagem|trilha|áreas externas~~icaridina~Seguir a faixa etária e as instruções da embalagem~7|8
0124~Repelente de Insetos Infantil 100 ml~Kidz Care~repelente~100 ml~24.9~4.5~260~0~infantil~repelente de insetos|mosquitos|viagem|trilha|áreas externas|uso infantil conforme a embalagem~~ativo repelente~Seguir a faixa etária e as instruções da embalagem~7|8
0125~Repelente de Insetos Spray 200 ml~Brisa~repelente~200 ml~27.9~4.3~310~0~adulto~repelente de insetos|mosquitos|viagem|trilha|áreas externas~~ativo repelente~Seguir a faixa etária e as instruções da embalagem~7|8
0126~Curativos Adesivos 40 un~Dauf~curativos~40 un~5.9~4.3~520~1~todos~pequenos cortes e arranhões|primeiros socorros|ferimentos superficiais~~~~9
0127~Curativo Impermeável 20 un~FlexCare~curativos~20 un~12.9~4.6~300~0~todos~pequenos cortes e arranhões|primeiros socorros|ferimentos superficiais|à prova d'água~~~~9
0128~Curativo Transparente 30 un~Cuide+~curativos~30 un~14.9~4.4~180~0~todos~pequenos cortes e arranhões|primeiros socorros|ferimentos superficiais|discreto~~~~9
0129~Algodão Hidrófilo 50 g~Dauf~algodao-gaze~50 g~4.9~4.2~400~1~todos~primeiros socorros|higiene|curativos|algodão~~~~
0130~Gaze Estéril 10 un~Dauf~algodao-gaze~10 un~4.5~4.3~260~1~todos~primeiros socorros|higiene|curativos|gaze~~~~
0131~Kit Gaze 20 un~FlexCare~algodao-gaze~20 un~6.9~4.4~150~0~todos~primeiros socorros|higiene|curativos|gaze~~~~
0132~Álcool em Gel 70% 500 g~Dauf~alcool~500 g~9.9~4.3~470~1~adulto~higienização das mãos|higienização de superfícies|primeiros socorros|gel~~álcool 70%~Produto inflamável: manter longe do fogo~10
0133~Álcool 70% Líquido 1 L~Dauf~alcool~1 L~11.9~4.2~330~1~adulto~higienização das mãos|higienização de superfícies|primeiros socorros|líquido~~álcool 70%~Produto inflamável: manter longe do fogo~10
0134~Álcool Gel 70% de Bolso 60 ml~Cuide+~alcool~60 ml~5.9~4.2~210~0~adulto~higienização das mãos|higienização de superfícies|primeiros socorros|bolso|viagem~~álcool 70%~Produto inflamável: manter longe do fogo~10
0135~Termômetro Digital 1 un~FlexCare~termometro~1 un~24.9~4.5~650~0~todos~medir a temperatura corporal|uso doméstico~~~Seguir o manual de uso do fabricante~11
0136~Termômetro Digital 1 un~Dauf~termometro~1 un~19.9~4.2~400~1~todos~medir a temperatura corporal|uso doméstico~~~Seguir o manual de uso do fabricante~11
0137~Termômetro Infravermelho de Testa 1 un~Cuide+~termometro~1 un~89.9~4.4~210~0~todos~medir a temperatura corporal|uso doméstico|sem contato~~~Seguir o manual de uso do fabricante~11
0138~Máscara de Dormir 1 un~Equilibra~conforto-sono~1 un~19.9~4.4~260~0~adulto~conforto para dormir|viagem|ambiente barulhento|luz|máscara de dormir~~~~
0139~Protetor Auricular de Espuma 6 pares~Equilibra~conforto-sono~6 pares~12.9~4.3~340~0~adulto~conforto para dormir|viagem|ambiente barulhento|luz|protetor auricular~~~~
0140~Máscara de Dormir de Gel 1 un~Ondas~conforto-sono~1 un~29.9~4.5~140~0~adulto~conforto para dormir|viagem|ambiente barulhento|luz|máscara de dormir~~~~
0141~Bolsa Térmica Gel 1 un~FlexCare~bolsa-termica~1 un~29.9~4.4~170~0~adulto~conforto muscular|calor local|relaxamento~~~Seguir o manual de uso do fabricante|Não aplicar diretamente em pele lesionada~
0142~Bolsa Térmica Água Quente 1 un~Cuide+~bolsa-termica~1 un~34.9~4.3~130~0~adulto~conforto muscular|calor local|relaxamento~~~Seguir o manual de uso do fabricante|Não aplicar diretamente em pele lesionada~
0143~Kit Rotina Facial Básica (Sabonete Facial + Água Micelar + Gel-Creme Hidratante) 3 itens~Dauf~kit-rotina-facial~3 itens~49.9~4.5~190~1~adulto~rotina facial|iniciante|custo-benefício~normal|mista|oleosa~~~0
0144~Kit Proteção Solar Dia a Dia (Facial FPS 50 + Corporal FPS 50 + Protetor Labial) 3 itens~Dauf~kit-protecao-solar~3 itens~64.9~4.6~210~1~adulto~proteção solar|praia|uso diário~todos~filtros UVA/UVB~Reaplicar conforme orientação da embalagem~2
0145~Kit Higiene Bucal (Creme Dental + Escova + Fio Dental + Enxaguante) 4 itens~Dauf~kit-higiene-bucal~4 itens~24.9~4.4~240~1~adulto~higiene bucal|família|escovação completa~~flúor~~5
0146~Kit Primeiros Socorros para Casa (Curativos + Algodão + Gaze + Álcool 70% + Termômetro) 5 itens~Dauf~kit-primeiros-socorros~5 itens~42.9~4.5~170~1~todos~primeiros socorros|casa|pequenos ferimentos~~~~9
0147~Kit Banho e Corpo (Sabonete Líquido + Hidratante Corporal + Desodorante) 3 itens~Dauf~kit-banho-corpo~3 itens~39.9~4.3~150~1~adulto~banho|hidratação|higiene diária|presente~todos~~~0
0148~Kit Viagem e Praia (Repelente + Protetor Solar Corporal FPS 30 + Pós-Sol) 3 itens~Dauf~kit-viagem~3 itens~54.9~4.4~160~1~adulto~viagem|praia|proteção solar|repelente~todos~~Reaplicar conforme orientação da embalagem~2
0149~Kit Cuidados Infantis (Sabonete + Shampoo + Loção Hidratante) 3 itens~Kidz Care~kit-cuidados-infantis~3 itens~44.9~4.7~200~0~infantil~banho do bebê|cuidados infantis|presente~sensível~~~0
0150~Conforto para Dormir Protetor Auricular de Silicone 3 pares~Ondas~conforto-sono~3 pares~24.9~4.4~120~0~adulto~conforto para dormir|viagem|ambiente barulhento|luz|protetor auricular~~~~
0151~Conforto para Dormir Máscara de Dormir 3D 1 un~Equilibra~conforto-sono~1 un~27.9~4.5~190~0~adulto~conforto para dormir|viagem|ambiente barulhento|luz|máscara de dormir~~~~`;
const CONTRA = ["Evitar em caso de alergia a algum componente da fórmula","Não aplicar em pele com lesões abertas","Interromper o uso em caso de irritação","Evitar contato com os olhos","Pode causar sensibilidade em pele muito sensível: teste prévio na pele é indicado","Manter fora do alcance de crianças pequenas","Não engolir","Evitar contato com olhos e mucosas","Não aplicar em pele com lesões","Em ferimentos profundos ou com sangramento intenso, buscar atendimento médico","Manter fora do alcance de crianças","Em caso de febre persistente ou sinais de gravidade, buscar atendimento médico"];
const RAW = CATALOGO;
const L = s => s ? s.split('|') : [];
const CAT = RAW.trim().split('\n').map(l => {
  const f = l.split('~');
  return { id:'prod-'+f[0], nome:f[1], marca:f[2], sub:f[3], tamanho:f[4], preco:+f[5], nota:+f[6], n:+f[7], mp:f[8]==='1',
    faixa:f[9], ind:L(f[10]), pele:L(f[11]), ingr:L(f[12]), alertas:L(f[13]), contra:L(f[14]).map(i=>CONTRA[+i]) };
});
const BYID = Object.fromEntries(CAT.map(p => [p.id, p]));

const GROUP = sub => {
  if (/infantil|lenco|kit-cuidados/.test(sub)) return 'infantil';
  if (/shampoo|condicionador|mascara-capilar|cachos|leave-in/.test(sub)) return 'cabelo';
  if (/dental|fio|enxaguante|bucal/.test(sub)) return 'bucal';
  if (/sabonete|desodorante|depilacao|absorvente|banho|hastes/.test(sub)) return 'corpo';
  if (/repelente|curativo|algodao|alcool|termometro|socorros|viagem/.test(sub)) return 'cuidados';
  if (/sono|bolsa/.test(sub)) return 'bem';
  return 'pele';
};
const GICON = {pele:'drop', cabelo:'sparkle', bucal:'smile', corpo:'bath', infantil:'baby', cuidados:'care', bem:'moon'};
const SUBLABEL = {
  'hidratante-corporal-seca':'pele seca no corpo','hidratante-corporal-diario':'hidratação diária','hidratante-facial':'hidratação do rosto',
  'protetor-solar-facial':'proteção solar no rosto','protetor-solar-corporal':'proteção solar no corpo','limpeza-facial':'limpeza do rosto',
  'demaquilante':'remover maquiagem','serum':'manchas leves','protetor-labial':'lábios ressecados','hidratante-maos':'mãos ressecadas',
  'pos-sol':'pós-sol','shampoo-diario':'limpeza dos cabelos','shampoo-anticaspa':'caspa','condicionador':'condicionamento',
  'mascara-capilar':'hidratação capilar','cachos':'cachos','leave-in':'finalização','creme-dental':'higiene bucal','escova-dental':'escovação',
  'fio-dental':'limpeza entre os dentes','enxaguante-bucal':'hálito fresco','sabonete-liquido':'banho','sabonete-barra':'banho',
  'desodorante':'desodorante','depilacao':'depilação','absorvente':'higiene íntima','sabonete-infantil':'banho do bebê',
  'shampoo-infantil':'cabelo infantil','hidratante-infantil':'hidratação infantil','lenco-umedecido':'troca de fraldas',
  'protetor-solar-infantil':'proteção solar infantil','hastes-flexiveis':'higiene das orelhas','creme-dental-infantil':'higiene bucal infantil',
  'repelente':'repelente','curativos':'pequenos ferimentos','algodao-gaze':'primeiros socorros','alcool':'higienização',
  'termometro':'medir temperatura','conforto-sono':'dormir melhor','bolsa-termica':'conforto muscular'
};

/* ============ Mock backend (port simplificado do pipeline) ============ */
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9$%,. ]+/g,' ').replace(/[.,](?!\d)/g,' ').replace(/\s+/g,' ').trim();
const hasPhrase = (t, p) => (' '+t+' ').includes(' '+p+' ');
const STOP = new Set('a o os as de da do das dos e em no na nos nas um uma uns umas para pra pro com sem que me meu minha meus minhas ate r reais quero queria preciso precisava algo alguma algum tenho estou esta ser ter muito mais bem bom boa qual quais tem usar produto produtos coisa coisas favor oi ola voce pode poderia indicar indica recomenda recomendar sugere sugestao opcao opcoes ajuda ajudar ou tipo so mim ele ela isso esse essa dia gastar custando custa preco valor $ melhor'.split(' '));
const GENERIC = new Set(['pele','cabelo','cabelos','rosto','corpo','cuidado','cuidados','rotina','diario','diaria','uso','higiene']);
const tokens = s => norm(s).split(' ').filter(t => t && !STOP.has(t) && !/^\d+([.,]\d+)?%?$/.test(t));
const tmatch = (a, b) => { if (a === b) return true; const n = Math.min(a.length, b.length); if (n < 5) return false; return a.slice(0,5) === b.slice(0,5); };

const INDEX = CAT.map(p => {
  const t = [];
  p.ind.forEach(x => tokens(x).forEach(k => t.push([k,3])));
  tokens(p.nome).forEach(k => t.push([k,2]));
  p.sub.split('-').forEach(k => k.length > 2 && t.push([norm(k),2]));
  p.ingr.forEach(x => tokens(x).forEach(k => t.push([k,1.5])));
  p.pele.forEach(x => tokens(x).forEach(k => t.push([k,1])));
  return { p, t, phr: p.ind.map(norm) };
});

const EMERG = [{"id":"emerg-cardio-respiratoria","termos":["dor no peito","aperto no peito","falta de ar","não consigo respirar","estou sem ar","coração disparado","desmaiei","desmaio","desmaiou","lábios roxos","parada cardíaca"],"resposta":"O que você descreve pode ser sério e precisa de atendimento médico agora. Ligue para o SAMU (192) ou procure a emergência mais próxima. Vou pausar as sugestões de produtos."},{"id":"emerg-neurologica","termos":["convulsão","convulsionando","rosto torto","boca torta","fala enrolada","perdi a visão","pior dor de cabeça da vida","confusão mental","paralisia","formigamento no braço"],"resposta":"Esses sinais precisam de avaliação médica imediata. Ligue para o SAMU (192) ou vá à emergência mais próxima. Vou pausar as sugestões de produtos."},{"id":"emerg-alergia-grave","termos":["garganta fechando","rosto inchado","língua inchada","lábios inchados","reação alérgica forte","reação alérgica grave","choque anafilático","anafilaxia"],"resposta":"Uma reação alérgica com esses sinais é emergência. Ligue para o SAMU (192) ou vá à emergência agora. Vou pausar as sugestões de produtos."},{"id":"emerg-sangramento-trauma","termos":["sangramento que não para","sangrando muito","vomitando sangue","fezes com sangue","queimadura grave","queimadura com bolhas","traumatismo","fratura exposta","corte profundo","bati a cabeça"],"resposta":"Isso precisa de atendimento médico imediato. Ligue para o SAMU (192) ou procure a emergência mais próxima. Vou pausar as sugestões de produtos."},{"id":"emerg-intoxicacao","termos":["overdose","tomei remédio demais","tomei muitos comprimidos","engoliu","engoli produto","envenenamento","intoxicação","criança engoliu","bebeu produto de limpeza"],"resposta":"Em caso de ingestão de produto ou medicamento em excesso, procure atendimento médico imediatamente ou ligue para o SAMU (192). Se puder, leve a embalagem. Vou pausar as sugestões de produtos."},{"id":"emerg-grupos-vulneraveis","termos":["bebê recém-nascido com febre","recém-nascido com febre","bebê não respira direito","bebê muito molinho","gestante sangrando","grávida sangrando","grávida com dor forte"],"resposta":"Nessa situação é importante buscar avaliação médica o quanto antes. Procure um serviço de saúde ou ligue para o SAMU (192). Vou pausar as sugestões de produtos."},{"id":"emerg-sinais-graves-gerais","termos":["febre há dias","febre muito alta","dor muito forte","não consigo levantar","pele muito vermelha com bolhas","manchas roxas pelo corpo"],"resposta":"Esses sinais merecem avaliação médica. Procure um serviço de saúde, e, se piorar ou houver risco imediato, ligue para o SAMU (192). Vou pausar as sugestões de produtos."},{"id":"crise-saude-mental","termos":["quero morrer","quero me matar","vou me matar","suicídio","não quero mais viver","me machucar","acabar com tudo","melhor sem mim","não aguento mais viver"],"resposta":"Sinto muito que você esteja passando por isso, e sua vida importa. Você não precisa enfrentar isso sozinho(a): o CVV atende 24 horas pelo telefone 188, de graça. Em risco imediato, ligue para o SAMU (192). Se quiser, posso ajudar a encontrar apoio perto de você."}];
const RESTR = {"controlado":"Esse tipo de medicamento é de controle especial e só pode ser vendido com receita, com avaliação de um profissional de saúde. Não posso indicá-lo. Posso te encaminhar para falar com um farmacêutico.","tarjado":"Esse medicamento exige receita e orientação profissional, então não posso indicá-lo. Posso te encaminhar para falar com um farmacêutico, ou te ajudar com produtos de cuidados e bem-estar.","uso_restrito":"Esse produto tem venda e uso restritos e depende de acompanhamento profissional, então não posso indicá-lo. Posso te encaminhar para falar com um farmacêutico ou orientar a buscar um serviço de saúde.","mip":"Não faço indicação de medicamentos, mesmo os de venda livre, porque a escolha depende de avaliação individual, e dúvidas sobre combinar remédios ou doses são com um profissional. Posso te encaminhar para falar com um farmacêutico, e te ajudo com produtos de cuidados e bem-estar.","sintoma_leve":"Sinto muito que você esteja assim. Eu não avalio sintomas nem indico medicamentos, mas um farmacêutico pode te orientar agora. Se piorar ou surgirem sinais de gravidade, procure atendimento médico."};
const GENERICOS = {"controlado":["calmante","remédio para dormir","remédio para ansiedade","antidepressivo","remédio para emagrecer","emagrecedor","moderador de apetite","anabolizante","remédio controlado","tarja preta","rivotril","clonazepam","sertralina","fluoxetina","zolpidem","sibutramina"],"tarjado":["antibiótico","anti-inflamatório forte","corticoide","caneta emagrecedora","remédio para pressão","remédio para diabetes","remédio para colesterol","remédio para disfunção","remédio com receita","amoxicilina","azitromicina","prednisona","losartana","metformina","sildenafila","ozempic"],"uso_restrito":["abortivo","remédio para abortar","induzir menstruação","provocar aborto","misoprostol","cytotec"],"mip":["remédio para dor","analgésico","remédio para febre","antitérmico","remédio para gripe","remédio para alergia","antialérgico","remédio para azia","antiácido","remédio para enjoo","remédio para cólica","remédio para diarreia","remédio para dor de cabeça","anti-inflamatório","o que tomar para","dipirona","paracetamol","ibuprofeno","loratadina","dorflex","neosaldina","buscopan"]};
const SINTOMA = ["dor de garganta","dor de cabeça","tosse","febre","dor nas costas","azia","enjoo","diarreia","estou com dor","estou gripado"];
const PEDIDO_MED = new Set(["tomar","remedio","remedios","medicamento","medicamentos","comprimido","comprimidos","medicacao","xarope"]);
const MSG = {
  instr:"Não consigo seguir esse tipo de instrução: as regras de segurança são as mesmas para todos os pedidos. Se quiser, me conte a necessidade que você quer resolver e eu indico produtos de cuidados e bem-estar.",
  prompt:"Não compartilho minhas instruções internas. Posso te ajudar a encontrar produtos de cuidados e bem-estar: qual necessidade você quer resolver?",
  papel:"Eu não sou farmacêutico nem faço prescrição, e isso não muda. Posso te encaminhar para falar com um farmacêutico, e te ajudo com produtos de cuidados e bem-estar.",
  aut:"Não consigo liberar itens restritos por esse motivo, e as regras valem para todos os pedidos. Posso te encaminhar para falar com um farmacêutico, ou te ajudar com produtos de cuidados e bem-estar.",
  id:"Os produtos e preços vêm direto do catálogo e não posso alterá-los. Me conte a necessidade que você quer resolver e eu mostro as opções disponíveis.",
  dados:"Não tenho acesso nem divulgo dados de outros clientes. Posso te ajudar a encontrar produtos de cuidados e bem-estar.",
  aleg:"Não faço alegações terapêuticas sobre produtos: só informo para que cada item é indicado, conforme o catálogo. Se tiver dúvida sobre saúde, um farmacêutico ou médico pode orientar.",
  preco:"Os preços vêm do catálogo e não posso alterá-los nem criar descontos. Posso te ajudar a montar uma seleção que caiba no seu orçamento.",
  marca:"Escolho os produtos pelo que serve à sua necessidade. A marca própria entra como desempate quando a indicação é a mesma e o preço é igual ou menor. Me conte o que você quer resolver e eu mostro as melhores opções."
};
const ADV = [
  [/\b(ignore|ignorar|esqueca|desconsidere|desconsiderar|desobedeca)\b.{0,40}\b(instrucoes|regras|orientacoes|prompt|restricoes)\b/, MSG.instr, false],
  [/\b(prompt|instrucoes|regras|configuracao)\b.{0,15}\b(de sistema|do sistema|internas?|internos?|ocultas?)\b/, MSG.prompt, false],
  [/\bsystem prompt\b/, MSG.prompt, false],
  [/\bvoce (agora )?(e|eh|sera) (um|uma) (farmaceutic[oa]|medic[oa]|doutor)\b/, MSG.papel, true],
  [/\bpode prescrever\b/, MSG.papel, true],
  [/\bfinja (que )?(voce )?(e|ser)\b/, MSG.instr, false],
  [/\bmodo (desenvolvedor|admin|dev)\b|\bjailbreak\b/, MSG.instr, false],
  [/\bteste interno\b|\bsou (da|do|o|a) (empresa|administrador|administradora|dono|dona|desenvolvedor)\b|\bautorizacao (especial|interna)\b|\blibere\b/, MSG.aut, true],
  [/\bprod \d{3,}\b/, MSG.id, false],
  [/\bcpf\b|\bcliente anterior\b|\boutro cliente\b|\bdados (pessoais )?(de|do) (outro|outros|cliente|clientes)\b|\bendereco do cliente\b/, MSG.dados, false],
  [/\b(diga|afirme|escreva|fale) que\b|\bcura(r|m)?\b.{0,40}\b(cancer|diabetes|doenca|doencas|covid)\b/, MSG.aleg, false],
  [/\bdesconto de \d+\b|\b(gere|gerar|crie|criar|aplique|aplicar)\b.{0,20}\bdesconto\b/, MSG.preco, false],
  [/\bmesmo que nao (sirva|sirvam|funcione|funcionem|combine|combinem)\b|\bsomente da marca\b/, MSG.marca, false]
];
const NEG = new Set(['nao','nunca','sem','nenhum','nenhuma']);
function findTerm(toks, term, respectNeg) {
  const tt = norm(term).split(' '); const n = tt.length;
  for (let i = 0; i + n <= toks.length; i++) {
    if (toks.slice(i, i+n).join(' ') === tt.join(' ')) {
      if (respectNeg && toks.slice(Math.max(0,i-3), i).some(t => NEG.has(t))) continue;
      return true;
    }
  }
  return false;
}
function guard(msg) {
  const tn = norm(msg), toks = tn.split(' ');
  for (const c of EMERG) for (const t of c.termos) if (findTerm(toks, t, c.id !== 'crise-saude-mental')) return {tipo:'bloqueio_emergencia', mensagem:c.resposta, oferecer_farmaceutico:false, classe:c.id};
  for (const [rx, m, f] of ADV) if (rx.test(tn)) return {tipo:'recusa_adversarial', mensagem:m, oferecer_farmaceutico:f};
  const pri = ['controlado','uso_restrito','tarjado','mip'];
  for (const k of pri) if (GENERICOS[k].some(t => hasPhrase(tn, norm(t)))) return {tipo:'bloqueio_restrito', mensagem:RESTR[k], oferecer_farmaceutico:true};
  if (SINTOMA.some(s => hasPhrase(tn, norm(s))) && toks.some(t => PEDIDO_MED.has(t))) return {tipo:'bloqueio_restrito', mensagem:RESTR.sintoma_leve, oferecer_farmaceutico:true};
  return null;
}

function interpret(msg) {
  const low = msg.toLowerCase(), tn = norm(msg);
  const it = { msg, toks: tokens(msg), orc: null, inf: false, pele: [], kit: false, barato: false };
  const m = low.match(/(?:at[ée]|m[áa]ximo(?: de)?|or[çc]amento(?: de)?|no m[áa]ximo)\s*(?:de\s*)?(?:r\$)?\s*(\d{1,5}(?:[.,]\d{1,2})?)/) || low.match(/r\$\s*(\d{1,5}(?:[.,]\d{1,2})?)/) || low.match(/(\d{1,5})\s*(?:reais|conto)/);
  if (m) it.orc = parseFloat(m[1].replace(',', '.'));
  it.inf = /\b(filh[oa]s?|bebes?|criancas?|infantil|kids|nenem|neto|neta)\b/.test(tn);
  for (const [k, rx] of [['seca',/pele (muito )?seca|ressecad/],['oleosa',/oleos/],['mista',/pele mista/],['sensivel',/sensivel|sensibilidade|irrita|ardo|arde|alergi/],['normal',/pele normal/]]) if (rx.test(tn)) it.pele.push(k);
  it.kit = /\b(rotina|kit|completo|completa|tudo que preciso)\b/.test(tn);
  it.barato = /barat|econom|em conta|custo beneficio|mais em conta/.test(tn);
  if (it.inf) it.toks.push('infantil','bebe');
  it.toks = [...new Set(it.toks.filter(t => !['filho','filha','filhos','crianca','criancas','kids','nenem'].includes(t)))];
  return it;
}

function scoreAll(it) {
  const q = it.toks, tn = norm(it.msg);
  return INDEX.map(({p, t, phr}) => {
    let s = 0;
    for (const qt of q) {
      let best = 0;
      for (const [k, w] of t) if (tmatch(qt, k)) best = Math.max(best, w);
      s += GENERIC.has(qt) ? best * 0.35 : best;
    }
    phr.forEach(ph => { if (ph.length > 4 && tn.includes(ph)) s += 2; });
    if (it.pele.length && p.pele.length && !p.pele.includes('todos')) {
      const fits = p.pele.some(x => it.pele.includes(norm(x).replace('muito ','')));
      if (!fits) return { p, s: -1 };
      s += 1.5;
    }
    if (p.faixa === 'infantil' && !it.inf) s -= 4;
    if (it.inf && p.faixa === 'adulto') s -= 3;
    return { p, s };
  }).filter(c => c.s > 0).sort((a,b) => b.s - a.s || b.p.nota - a.p.nota);
}

const COMPL = {
  facial:['limpeza-facial','hidratante-facial','protetor-solar-facial'],
  corpo:['sabonete-liquido','hidratante-corporal-seca'],
  cabelo:['shampoo-diario','condicionador','mascara-capilar'],
  anticaspa:['shampoo-anticaspa','condicionador'],
  bucal:['creme-dental','escova-dental','fio-dental','enxaguante-bucal'],
  bebe:['sabonete-infantil','shampoo-infantil','hidratante-infantil'],
  praia:['protetor-solar-corporal','pos-sol','repelente']
};
function complementsFor(sub) {
  if (/facial|serum|demaquilante/.test(sub)) return COMPL.facial;
  if (/anticaspa/.test(sub)) return COMPL.anticaspa;
  if (/shampoo-diario|condicionador|mascara|leave|cachos/.test(sub)) return COMPL.cabelo;
  if (/corporal-seca|corporal-diario|sabonete-liquido|sabonete-barra/.test(sub)) return COMPL.corpo;
  if (/dental|fio|enxaguante/.test(sub)) return COMPL.bucal;
  if (/infantil|lenco/.test(sub)) return COMPL.bebe;
  if (/solar-corporal|pos-sol|repelente/.test(sub)) return COMPL.praia;
  return [sub];
}

function pickBest(list, it) {
  const top = list[0].s;
  const near = list.filter(c => c.s >= (it.barato ? top * 0.45 : top - 1));
  near.sort((a,b) => it.barato ? a.p.preco - b.p.preco : (b.s - a.s) || (b.p.nota - a.p.nota));
  let ch = near[0];
  const mp = near.find(c => c.p.mp && c.p.preco <= ch.p.preco && c.s >= ch.s - 0.5);
  if (mp) ch = mp;
  return ch;
}

function justify(c, it, cheapestInSub) {
  const p = c.p, q = it.toks; const parts = [];
  const hit = p.ind.filter(ph => tokens(ph).some(k => q.some(x => !GENERIC.has(x) && tmatch(x, k)))).slice(0, 2);
  parts.push('Indicado para ' + (hit.length ? hit.join(' e ') : p.ind.slice(0,2).join(' e ')));
  if (it.pele.length && p.pele.length && !p.pele.includes('todos')) {
    const f = p.pele.find(x => it.pele.includes(norm(x).replace('muito ','')));
    if (f) parts.push('combina com pele ' + f);
  }
  if (p.ingr.length) parts.push('tem ' + p.ingr.slice(0,2).join(' e '));
  if (cheapestInSub) parts.push('menor preço entre as opções que atendem');
  if (p.mp) parts.push('marca própria com a mesma indicação');
  return parts.join(' · ');
}

function toCard(c, it, cheapest) {
  const p = c.p;
  return { id:p.id, nome:p.nome, marca:p.marca, categoria:GROUP(p.sub), subcategoria:p.sub, tamanho:p.tamanho, preco:p.preco, nota:p.nota,
    num_avaliacoes:p.n, imagem:`assets/produtos/${p.id}.png`, marca_propria:p.mp, justificativa:justify(c, it, cheapest), avisos:[...p.alertas, ...p.contra] };
}

const CTX = {};
function mockRecommend(mensagem, sessao_id) {
  const g = guard(mensagem);
  if (g) return { tipo:g.tipo, mensagem:g.mensagem, produtos:[], ficou_de_fora:[], kit:null, avisos:[], pergunta:null, oferecer_farmaceutico:g.oferecer_farmaceutico, orcamento:null, total:null };
  const ctx = CTX[sessao_id];
  const tn = norm(mensagem);

  // Follow-up de comparação (equivale à ferramenta comparar_opcoes do agente)
  if (ctx && ctx.ids.length >= 2 && /compar|diferenca|qual (e )?(o |a )?melhor|qual escolher/.test(tn)) {
    let ids = ctx.ids;
    const ord = [['primeir',0],['segund',1],['terceir',2],['quart',3]];
    const pickIdx = ord.filter(([w]) => tn.includes(w)).map(([,i]) => i);
    const sel = [].filter(id => ids.includes(id));
    const nFirst = /\b(duas|dois) primeir/.test(tn) ? 2 : /\btres primeir/.test(tn) ? 3 : 0;
    if (sel.length >= 2) ids = sel; else if (nFirst) ids = ids.slice(0, nFirst); else if (pickIdx.length >= 2) ids = pickIdx.map(i => ids[i]).filter(Boolean); else ids = ids.slice(0, 3);
    const ps = ids.map(id => BYID[id]);
    const cheap = ps.reduce((a,b) => a.preco <= b.preco ? a : b), best = ps.reduce((a,b) => a.nota >= b.nota ? a : b);
    const msg = `Comparando ${ps.length} opções: ` + ps.map(p => `${p.nome} (${p.marca}), ${brl(p.preco)}, nota ${p.nota.toFixed(1)}`).join('; ') + `. A mais em conta é ${cheap.nome}; a mais bem avaliada é ${best.nome}.`;
    const it = ctx.it;
    return { tipo:'recomendacao', mensagem:msg, produtos:ps.map(p => toCard({p, s:0}, it, p === cheap)), ficou_de_fora:[], kit:null, avisos:[], pergunta:null, oferecer_farmaceutico:false, orcamento:null, total:null };
  }

  let it = interpret(mensagem);
  let cands = scoreAll(it);
  // Follow-up curto: completa com as preferências da sessão
  const isFollow = it.orc != null || it.barato || it.inf || it.pele.length || /\b(outra|outras|outro|outros|diferente|mais|menos|tambem|essa|esse|dessas|desses)\b/.test(tn);
  if ((!cands.length || cands[0].s < 3) && ctx && isFollow) {
    const prev = ctx.it;
    const merged = { ...prev, msg: prev.msg + ' ' + mensagem, toks:[...new Set([...prev.toks, ...it.toks])],
      orc: it.orc ?? prev.orc, inf: it.inf || prev.inf, pele: it.pele.length ? it.pele : prev.pele, kit: it.kit || prev.kit, barato: it.barato || prev.barato };
    if (/outra|outras|diferente/.test(tn)) merged.exclude = ctx.ids;
    it = merged; cands = scoreAll(it);
  }
  if (it.exclude) cands = cands.filter(c => !it.exclude.includes(c.p.id));
  if (!cands.length || cands[0].s < 3) {
    const p = it.toks.length ? 'Quero acertar na indicação: é para rosto, corpo, cabelo, higiene bucal ou para o bebê? Se tiver um tipo de pele ou orçamento, me conta também.'
                             : 'Me conta o que você quer resolver. Por exemplo: pele seca, caspa, proteção solar para a praia ou banho do bebê.';
    return { tipo:'clarificacao', mensagem:p, produtos:[], ficou_de_fora:[], kit:null, avisos:[], pergunta:p, oferecer_farmaceutico:false, orcamento:it.orc, total:null };
  }

  const top = cands[0].s;
  const bySub = new Map();
  cands.forEach(c => { if (!bySub.has(c.p.sub)) bySub.set(c.p.sub, []); bySub.get(c.p.sub).push(c); });
  let alvo = [...bySub.keys()].filter(k => bySub.get(k)[0].s >= top * 0.8 && !k.startsWith('kit-'));
  if (!alvo.length) alvo = [cands[0].p.sub];
  const rotina = it.kit || alvo.length >= 2;
  const fora = [];
  let chosen = [];

  if (rotina) {
    let subs = alvo.slice(0, 4);
    if (it.kit) subs = [...new Set([...subs, ...complementsFor(subs[0])])].slice(0, 4);
    for (const sub of subs) {
      let list = bySub.get(sub);
      if (!list) { list = CAT.filter(p => p.sub === sub).map(p => ({p, s:1 + (it.pele.length && p.pele.some(x => it.pele.includes(norm(x))) ? 1 : 0)})).sort((a,b)=>b.s-a.s||a.p.preco-b.p.preco); }
      if (!list.length) continue;
      const ch = pickBest(list, it);
      chosen.push({ c:ch, list });
      const alt = list.filter(x => x !== ch).sort((a,b)=>a.p.preco-b.p.preco)[0];
      if (alt && alt.p.preco > ch.p.preco) fora.push({ produto_id:alt.p.id, nome:alt.p.nome, motivo:`Mesma função de ${ch.p.nome}, por ${brl(alt.p.preco - ch.p.preco)} a mais.` });
    }
    if (it.orc) {
      let total = () => chosen.reduce((a,x) => a + x.c.p.preco, 0);
      let guard2 = 0;
      while (total() > it.orc && guard2++ < 20) {
        const swap = chosen.map(x => ({x, alt:x.list.filter(y => y.p.preco < x.c.p.preco).sort((a,b)=>a.p.preco-b.p.preco)[0]})).filter(o => o.alt).sort((a,b) => (b.x.c.p.preco - b.alt.p.preco) - (a.x.c.p.preco - a.alt.p.preco))[0];
        if (swap) { fora.unshift({ produto_id:swap.x.c.p.id, nome:swap.x.c.p.nome, motivo:`Trocado por uma opção equivalente mais barata para caber em ${brl(it.orc)}.` }); swap.x.c = swap.alt; continue; }
        const drop = chosen.slice().sort((a,b) => a.c.s - b.c.s)[0];
        fora.unshift({ produto_id:drop.c.p.id, nome:drop.c.p.nome, motivo:`Ficou de fora para o kit caber no orçamento de ${brl(it.orc)}.` });
        chosen = chosen.filter(x => x !== drop);
        if (!chosen.length) break;
      }
      if (!chosen.length) {
        const min = Math.min(...alvo.map(s => Math.min(...bySub.get(s).map(c => c.p.preco))));
        const msg = `Não encontrei opções adequadas dentro de ${brl(it.orc)}: a mais barata que atende ao seu pedido custa ${brl(min)}. Quer ajustar o orçamento ou priorizar um item?`;
        return { tipo:'clarificacao', mensagem:msg, produtos:[], ficou_de_fora:[], kit:null, avisos:[], pergunta:msg, oferecer_farmaceutico:false, orcamento:it.orc, total:null };
      }
    }
    chosen = chosen.map(x => ({ c:x.c, cheap: x.list.every(y => y.p.preco >= x.c.p.preco) }));
  } else {
    let pool = alvo.slice(0, 2).flatMap(s => bySub.get(s));
    if (it.barato) { const t0 = pool[0]?.s || 0; pool = pool.filter(c => c.s >= t0 * 0.45); }
    pool.sort((a,b) => it.barato ? a.p.preco - b.p.preco : (b.s - a.s) || (b.p.nota - a.p.nota));
    if (it.orc) {
      pool.filter(c => c.p.preco > it.orc).slice(0, 2).forEach(c => fora.push({ produto_id:c.p.id, nome:c.p.nome, motivo:`Acima do seu orçamento de ${brl(it.orc)}.` }));
      pool = pool.filter(c => c.p.preco <= it.orc);
      if (!pool.length) {
        const min = Math.min(...alvo.flatMap(s => bySub.get(s).map(c => c.p.preco)));
        const msg = `Não encontrei opções adequadas dentro de ${brl(it.orc)}: a mais barata que atende ao seu pedido custa ${brl(min)}. Quer ajustar o orçamento ou priorizar um item?`;
        return { tipo:'clarificacao', mensagem:msg, produtos:[], ficou_de_fora:[], kit:null, avisos:[], pergunta:msg, oferecer_farmaceutico:false, orcamento:it.orc, total:null };
      }
    }
    const minP = Math.min(...pool.map(c => c.p.preco));
    chosen = pool.slice(0, 4).map(c => ({ c, cheap: c.p.preco === minP }));
  }
  // itens descartados por tipo de pele
  if (it.pele.length) {
    const bad = CAT.filter(p => alvo.includes(p.sub) && p.pele.length && !p.pele.includes('todos') && !p.pele.some(x => it.pele.includes(norm(x).replace('muito ','')))).slice(0, 1);
    bad.forEach(p => fora.push({ produto_id:p.id, nome:p.nome, motivo:`Indicado para pele ${p.pele.join(', ')}, diferente do que você descreveu.` }));
  }

  const produtos = chosen.map(x => toCard(x.c, it, x.cheap));
  const soma = +produtos.reduce((a,p) => a + p.preco, 0).toFixed(2);
  const kit = rotina && produtos.length >= 2 ? { produto_ids: produtos.map(p => p.id), subtotal: soma } : null;
  const total = kit ? soma : null;
  const nec = [...new Set(chosen.map(x => SUBLABEL[x.c.p.sub] || x.c.p.sub))].slice(0, 3).join(', ');
  let msg = (it.barato ? 'Priorizei as opções mais em conta. ' : '') + `Separei ${produtos.length} ${produtos.length === 1 ? 'opção' : 'opções'} para ${nec}.`;
  if (kit) msg += ` O kit completo soma ${brl(soma)}` + (it.orc ? `, dentro do seu orçamento de ${brl(it.orc)}.` : '.');
  else if (it.orc) msg += ` Todas cabem no seu orçamento de ${brl(it.orc)}.`;
  const foraU = fora.filter((f, i, a) => a.findIndex(g => g.produto_id === f.produto_id) === i && !produtos.some(p => p.id === f.produto_id)).slice(0, 4);
  if (foraU.length) msg += ' Veja abaixo o que deixei de fora e por quê.';
  const avisos = [...new Set(chosen.flatMap(x => x.c.p.alertas))];
  CTX[sessao_id] = { it, ids: produtos.map(p => p.id), t: Date.now() };
  return { tipo:'recomendacao', mensagem:msg, produtos, ficou_de_fora:foraU, kit, avisos, pergunta:null, oferecer_farmaceutico:false, orcamento:it.orc, total };
}


export function demoRecomendar(mensagem: string, sessaoId: string): RecommendResponse {
  return mockRecommend(mensagem, sessaoId);
}

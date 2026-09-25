# Auditoria PWA — ETAPA A · diagnóstico real

Data: 2026-09-25  
Escopo: manifest + Service Worker + instalação, com evidência de runtime no GitHub Pages.  
Fonte de verdade: branch `main` + deploy GitHub Pages + teste Selenium do workflow de publicação.

## Estado do código antes desta auditoria

HEAD observado: `ef4eb89759210a1daec725391a102a640e6ead55`.

URL canônica exercitada pelo workflow:
`https://saling-vitor.github.io/planodeestudos/`

Observação importante: a captura do usuário mostra o endereço com capitalização diferente,
`/PlanejamentoEstudos/`. O pipeline de produção e o teste automatizado real exercitam
`/planodeestudos/`. Portanto, a variante com capitalização diferente **não deve ser tratada como já
validada** por esta auditoria. O caminho canônico do deploy atual é o usado pelo workflow.

## Manifest — runtime real

No deploy exercitado pelo navegador real:

- HTTP: 200
- MIME: `application/manifest+json; charset=utf-8`
- URL: `https://saling-vitor.github.io/planodeestudos/manifest.webmanifest`
- `id`: `./`
- `start_url`: `./index.html`
- `scope`: `./`
- `display`: `standalone`

Ícones exercitados por fetch real:

- `assets/img/pwa-icon-192.svg` → 200, `image/svg+xml`
- `assets/img/pwa-icon-512.svg` → 200, `image/svg+xml`
- `assets/img/pwa-icon-maskable-512.svg` → 200, `image/svg+xml`

O uso de caminhos relativos é compatível com o subdiretório do GitHub Pages e evita o erro clássico
de usar `/` como raiz do aplicativo.

## Service Worker — runtime real

Arquivo publicado:

- URL: `https://saling-vitor.github.io/planodeestudos/service-worker.js`
- HTTP: 200
- MIME: `application/javascript; charset=utf-8`
- versão publicada no deploy observado: `19.2-ef4eb897`

Estado observado via APIs do navegador:

- suporte a Service Worker: sim
- registration: presente
- scope: `https://saling-vitor.github.io/planodeestudos/`
- active: presente
- active.state: `activated`
- waiting: nenhum no estado final
- installing: nenhum no estado final
- controller: presente
- controller.state: `activated`

Logo, no caminho canônico exercitado, não foi inferido apenas pelo código: o navegador realmente
registrou o worker e a página ficou controlada.

## Instalação — runtime real

No Chromium headless usado no deploy:

- protocolo: HTTPS
- execução: `NAVEGADOR`
- instalado: não
- `beforeinstallprompt` capturado: sim
- estado de instalação: `DISPONIVEL`
- erro PWA registrado: vazio

Isso prova que, nesse ambiente Chromium do deploy, os requisitos de instalação foram aceitos pelo
navegador e o código capturou o evento de instalação.

Não usar este resultado para afirmar que iPad/Safari expõe o mesmo evento. O código trata iOS/iPadOS
separadamente, com instalação manual pela Tela de Início.

## Estado real da UI

O mesmo teste de runtime leu os campos da tela de Configurações depois do deploy:

- Execução: `NAVEGADOR`
- Instalação: `DISPONÍVEL`
- Versão: `19.2-ef4eb897`
- Offline: `NÃO BAIXADO`
- Atualização: `ATUALIZADO`
- Manifest: `OK · 200`
- Service Worker: `ATIVO · activated`
- Controle da página: `SIM`
- HTTPS: `OK`

O HTML atual inicia os campos como `VERIFICANDO`, não como `—`, e `renderPwa()` substitui esses
valores por estados detectados. Portanto, um `—` persistente não corresponde ao estado produzido
pelo caminho canônico que foi exercitado neste deploy.

## Atualização — evidência já observada

O navegador foi mantido entre a versão anterior e o novo deploy.

Ciclo observado:

- baseline ativo: `19.2-3f51ccf6`
- worker novo publicado: `19.2-ef4eb897`
- worker ativo final: `19.2-ef4eb897`
- worker waiting final: não

Isso confirma troca real de versão no navegador do workflow, não apenas comparação de strings no
repositório.

## Cache e offline — evidência disponível nesta etapa

Antes do download explícito do pacote:

- cache offline do usuário: 0 arquivos

Depois do exercício do pacote:

- core: 22 arquivos
- offline: 64 arquivos
- runtime: 38 arquivos
- versão reportada: `19.2-ef4eb897`

Rotas exercitadas offline pelo teste:
- `index.html`
- `biblioteca.html`
- um mapa real
- um simulado real
- o PDF do edital, com HTTP 200 e 4.396.618 bytes

O navegador não registrou erros `SEVERE` no console durante o smoke test.

A auditoria completa do pacote offline pertence à ETAPA E, mas esses resultados são evidência real
já disponível e não devem ser descartados.

## Fonte da versão

Há duas camadas deliberadas:

- `pa-pwa-v01.js`: versão lógica `19.2`
- `service-worker.js`: `19.2-source` no repositório

No workflow, imediatamente antes da publicação, o Service Worker recebe:
`19.2-<short SHA do commit>`.

A tela usa prioritariamente a versão lida do arquivo Service Worker publicado. Assim, no deploy real,
a versão visível pode identificar o build exato, por exemplo `19.2-ef4eb897`.

## Diagnóstico da captura fornecida

A captura mostra a área Configurações carregada em:
`saling-vitor.github.io/PlanejamentoEstudos/...`

O deploy e o runtime automatizado atuais validam:
`saling-vitor.github.io/planodeestudos/...`

Esse desvio de capitalização é a principal diferença objetiva entre a captura e o ambiente que hoje
possui prova automatizada de runtime. Não atribuir o problema genericamente a cache.

## Resultado da ETAPA A

Comprovado no caminho canônico do deploy:

- manifest responde e é parseável;
- ícones respondem 200;
- Service Worker é registrado;
- Service Worker fica ativo;
- página fica controlada;
- contexto é HTTPS;
- navegador Chromium considera o app instalável;
- versão publicada é derivada do SHA;
- UI consegue refletir os estados reais;
- atualização de worker foi exercitada;
- não houve erro crítico de console no teste.

Pendência que segue para as próximas etapas:

1. eliminar ambiguidade da variante `/PlanejamentoEstudos/` usada na captura e garantir que o
   usuário sempre opere no caminho canônico;
2. continuar o pente-fino de detecção/UI (ETAPA B);
3. exercitar instalação como ação do usuário (ETAPA C);
4. revisar atualização manual e waiting worker (ETAPA D);
5. aprofundar pacote/cache/offline (ETAPA E);
6. repetir teste final do deploy (ETAPA F);
7. revisão visual final (ETAPA G).

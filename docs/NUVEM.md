# Plano ARQ · Nuvem

A aplicação é **local-first**. O navegador continua sendo a primeira gravação. A nuvem acrescenta duas camadas independentes:

- **Supabase**: sincronização contínua entre dispositivos.
- **Google Drive**: snapshots de recuperação e histórico de backup.

## 1. Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor** e execute integralmente `cloud/supabase_schema_V1.sql`.
3. Confirme que existem:
   - tabela `public.plano_arq_sync_records`;
   - RLS habilitado;
   - função `public.plano_arq_upsert_sync_records(jsonb)`.
4. Em **Authentication**, mantenha o provedor de e-mail habilitado.
5. Para login por código, configure o template de Magic Link/OTP para conter `{{ .Token }}`. O arquivo `cloud/email_template_otp.html` é o modelo operacional versionado para essa configuração.
6. No Plano ARQ > **Configurações**:
   - cole a **Project URL**;
   - cole a **Publishable key**;
   - clique **Salvar configuração**;
   - clique **Testar conexão**;
   - informe o e-mail;
   - clique **Enviar código** e confirme o OTP;
   - por fim clique **Sincronizar agora**.

Nunca use `service_role`, secret key ou outra credencial privada no navegador.

## 2. Google Drive

O Drive é usado apenas como backup/snapshot, não como banco principal.

No Google Cloud Console, use um único projeto para as credenciais abaixo:

1. Habilite **Google Drive API** e **Google Picker API**.
2. Configure a tela de consentimento OAuth.
3. Crie um **OAuth Client ID** do tipo **Web application**.
4. Em **Authorized JavaScript origins**, adicione:
   - `https://saling-vitor.github.io`
   - opcionalmente `http://localhost` para testes locais.
5. Crie uma **API key** e restrinja:
   - aplicação: Websites;
   - sites permitidos: `https://saling-vitor.github.io/*`, `https://docs.google.com/*` e, se necessário, `http://localhost/*`;
   - APIs: Google Picker API e Google Drive API.
6. Copie o **Project number** em IAM & Admin > Settings. Esse número é o App ID usado pelo Picker.
7. No Plano ARQ > **Configurações > Google Drive · projeto**, informe:
   - OAuth Client ID;
   - API key;
   - Project number / App ID.
8. Clique **Salvar configuração** e **Conectar Google Drive**.
9. Clique **Selecionar/autorizar pasta** e escolha `#SITEPLANODEESTUDOS`.
10. Clique **Testar acesso**.
11. Crie um **snapshot do concurso** para validar a gravação.

O runtime usa o escopo `drive.file`, portanto a pasta precisa ser explicitamente selecionada pelo Picker.

## 3. Política sugerida

- Sincronização Supabase automática: **ligada**, intervalo de **60 s**.
- Snapshot Drive automático: **ligado**, a cada **24 h**.
- Snapshot após sync: **ligado**.
- Retenção: **10 snapshots** por escopo.
- PWA/offline: baixar o pacote completo no dispositivo principal.

## 4. Segurança

A pasta de snapshots deve permanecer **privada**. Não use compartilhamento “qualquer pessoa com o link pode editar”.

Project URL, Publishable key, OAuth Client ID, API key e App ID são configurações de cliente. Mesmo assim, restrinja a API key por origem e APIs. Tokens OAuth e credenciais privadas não devem ser versionados.

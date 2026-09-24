# Plano ARQ · Nuvem

A aplicação é **local-first**. O navegador mantém o estado de estudo e, quando o usuário configura uma conta Supabase, o módulo de sincronização pode replicar os dados para a nuvem.

## Supabase

1. Crie um projeto Supabase.
2. Execute `cloud/supabase_schema_V1.sql` no SQL Editor.
3. Em Authentication, habilite o fluxo de e-mail/OTP desejado.
4. Opcionalmente use `cloud/email_template_otp.html` como base para o e-mail.
5. No Plano ARQ, informe a URL do projeto e a chave publicável em Configurações.

Não grave chaves privadas/service-role no repositório ou no navegador.

## Google Drive

O Drive é usado para snapshots/backup, não como banco principal da aplicação. A pasta é escolhida pelo usuário no próprio Portal quando a integração está configurada.

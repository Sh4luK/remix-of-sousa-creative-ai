
Objetivo

Corrigir a montagem do prompt para que todas as informações comerciais sejam enviadas de forma consistente, sem instruções contraditórias, reduzindo falhas na geração.

Diagnóstico

- `buildPrompt()` hoje concatena tudo em texto corrido, o que dificulta controle e depuração.
- Há um conflito direto: quando `textRules = "espaco-preco"`, o prompt pede para deixar espaço para preço, mas também manda “Do not render text in the image”. Isso anula preço, headline, CTA e oferta.
- O mesmo problema existe com `sem-texto`: campos textuais podem ser enviados antes, mas o prompt depois proíbe texto.
- Existem campos definidos no modelo que não estão alinhados entre UI e motor (`discount`, `promoText`, `secondaryText`, `secondaryColors`, `applySeal`, `applyLogo`), gerando comportamento imprevisível.

Plano

1. Refatorar a montagem do prompt em `src/lib/promptEngine.ts`
- Trocar a concatenação solta por blocos estruturados:
  - objetivo
  - produto
  - oferta/preço
  - textos obrigatórios
  - layout/formato
  - estilo visual
  - restrições
  - negative prompt
- Normalizar entradas (`trim`, remoção de vazios, evitar frases duplicadas e conflitos).
- Incluir de forma consistente todos os campos suportados: preço, preço anterior, desconto, quantidade, headline, secondaryText, promoText, CTA, observações extras, cores e selo.

2. Criar uma regra única para comportamento de texto
- Derivar um modo interno com base em `textRules` + campos preenchidos.
- Ajustar a lógica para:
  - se houver preço/headline/CTA/etc., o prompt pedir texto legível e hierarquia clara;
  - `espaco-preco` significar “organizar área de oferta”, e não “proibir texto”;
  - `sem-texto` remover instruções textuais do prompt ou impedir combinação incompatível.
- Isso elimina a principal causa de preço e headline não aparecerem.

3. Alinhar formulário e schema em `src/pages/NewGeneration.tsx`
- Garantir que o frontend só monte prompt com campos realmente suportados.
- Resolver a inconsistência entre o que existe no estado e o que o usuário consegue preencher:
  - ou expor os campos faltantes (`discount`, `secondaryText`, `promoText`);
  - ou remover do schema os que não serão usados agora.
- Manter o “Ver prompt utilizado” como forma de auditoria do resultado final.

4. Adicionar validações antes da geração
- Bloquear combinações contraditórias no cliente, por exemplo:
  - `sem-texto` junto com headline/preço/CTA;
  - campos de oferta preenchidos com uma regra que mande não renderizar texto.
- Mostrar erro claro antes de chamar a geração, em vez de enviar prompt inconsistente.

5. Melhorar a robustez do backend em `supabase/functions/generate-image/index.ts`
- Manter a geração atual, mas registrar melhor o prompt final normalizado.
- Se a IA não retornar imagem, logar um resumo dos blocos do prompt para facilitar diagnóstico futuro.
- Assim, se houver novo problema, fica claro se foi conflito de prompt, ausência de campo ou resposta do modelo.

Detalhes técnicos

Estrutura sugerida:
```text
[objetivo da arte]
[produto]
[oferta e preços]
[textos que devem aparecer]
[formato e composição]
[estilo visual e cores]
[restrições]
[negative prompt]
```

Arquivos a revisar

- `src/lib/promptEngine.ts`
- `src/pages/NewGeneration.tsx`
- `supabase/functions/generate-image/index.ts`

Resultado esperado

- Preço, preço anterior, desconto, headline e CTA deixam de se anular.
- O prompt passa a ser previsível, auditável e sem conflitos lógicos.
- A geração fica mais estável e mais fiel às informações preenchidas pelo usuário.

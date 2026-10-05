-- TokenTrim universal documents (v1.2): track source format + OCR usage.
-- Run in Supabase SQL editor after 0001 + 0002.

alter table public.user_documents
  add column if not exists source_type text not null default 'pdf'
    check (source_type in ('pdf','docx','pptx','image','xlsx','csv','text','html','epub','other'));
alter table public.user_documents
  add column if not exists original_filename text;
alter table public.user_documents
  add column if not exists ocr_used boolean not null default false;

create index if not exists idx_documents_type_created
  on public.user_documents(source_type, created_at desc);

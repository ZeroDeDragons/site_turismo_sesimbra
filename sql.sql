-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.Perfil (
  id uuid NOT NULL,
  admin boolean DEFAULT false,
  biografia text,
  data_de_nascimento date,
  telemovel_prefixo text,
  telemovel_numero text,
  avatar_url text,
  avatar_cor text,
  genero text,
  primeiro_nome text,
  ultimo_nome text,
  CONSTRAINT Perfil_pkey PRIMARY KEY (id),
  CONSTRAINT Perfil_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.Categorias (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nome text NOT NULL,
  cor text,
  simbolo text,
  criado_em timestamp with time zone DEFAULT now(),
  criado_por uuid,
  CONSTRAINT Categorias_pkey PRIMARY KEY (id),
  CONSTRAINT Categorias_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.Perfil(id)
);
CREATE TABLE public.Local (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nome text NOT NULL,
  descricao text,
  posicao USER-DEFINED NOT NULL,
  criado_em timestamp with time zone DEFAULT now(),
  criado_por uuid,
  is_public boolean DEFAULT false,
  CONSTRAINT Local_pkey PRIMARY KEY (id),
  CONSTRAINT Local_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.Perfil(id)
);
CREATE TABLE public.Fotos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nome text,
  descricao text,
  local_origem text,
  criado_em timestamp with time zone DEFAULT now(),
  criado_por uuid,
  CONSTRAINT Fotos_pkey PRIMARY KEY (id),
  CONSTRAINT Fotos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.Perfil(id)
);
CREATE TABLE public.Segmento (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_local1 bigint,
  id_local2 bigint,
  CONSTRAINT Segmento_pkey PRIMARY KEY (id),
  CONSTRAINT Segmento_id_local1_fkey FOREIGN KEY (id_local1) REFERENCES public.Local(id),
  CONSTRAINT Segmento_id_local2_fkey FOREIGN KEY (id_local2) REFERENCES public.Local(id)
);
CREATE TABLE public.Rotas (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_segmento bigint,
  nome text NOT NULL,
  descricao text,
  criado_em timestamp with time zone DEFAULT now(),
  criado_por uuid,
  is_public boolean DEFAULT false,
  cor bigint,
  CONSTRAINT Rotas_pkey PRIMARY KEY (id),
  CONSTRAINT Rotas_id_segmento_fkey FOREIGN KEY (id_segmento) REFERENCES public.Segmento(id),
  CONSTRAINT Rotas_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES public.Perfil(id)
);
CREATE TABLE public.Local_Fotos (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_foto bigint,
  id_local bigint,
  CONSTRAINT Local_Fotos_pkey PRIMARY KEY (id),
  CONSTRAINT Local_Fotos_id_foto_fkey FOREIGN KEY (id_foto) REFERENCES public.Fotos(id),
  CONSTRAINT Local_Fotos_id_local_fkey FOREIGN KEY (id_local) REFERENCES public.Local(id)
);
CREATE TABLE public.Utilizador_Categoria (
  id_user uuid NOT NULL,
  id_categoria bigint NOT NULL,
  CONSTRAINT Utilizador_Categoria_pkey PRIMARY KEY (id_user, id_categoria),
  CONSTRAINT Utilizador_Categoria_id_user_fkey FOREIGN KEY (id_user) REFERENCES public.Perfil(id),
  CONSTRAINT Utilizador_Categoria_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.Categorias(id)
);
CREATE TABLE public.Local_Categoria (
  id_local bigint NOT NULL,
  id_categoria bigint NOT NULL,
  CONSTRAINT Local_Categoria_pkey PRIMARY KEY (id_local, id_categoria),
  CONSTRAINT Local_Categoria_id_local_fkey FOREIGN KEY (id_local) REFERENCES public.Local(id),
  CONSTRAINT Local_Categoria_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.Categorias(id)
);
CREATE TABLE public.Rota_Categoria (
  id_rota bigint NOT NULL,
  id_categoria bigint NOT NULL,
  CONSTRAINT Rota_Categoria_pkey PRIMARY KEY (id_rota, id_categoria),
  CONSTRAINT Rota_Categoria_id_rota_fkey FOREIGN KEY (id_rota) REFERENCES public.Rotas(id),
  CONSTRAINT Rota_Categoria_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.Categorias(id)
);
-- More parts of speech in the dictionary: articles, determiners, numbers and
-- particles ("the", "every", "two", "yes") have Indonesian meanings in
-- Wiktionary too. Only widens the checks, so code that does not know the new
-- values keeps working.
alter table public.dict_entries drop constraint dict_entries_pos_check;
alter table public.dict_entries add constraint dict_entries_pos_check check (
  pos in (
    'noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'phrase',
    'article', 'det', 'num', 'particle'
  )
);

alter table public.saved_words drop constraint saved_words_pos_check;
alter table public.saved_words add constraint saved_words_pos_check check (
  pos in (
    'noun', 'verb', 'adj', 'adv', 'pron', 'prep', 'conj', 'interj', 'phrase',
    'article', 'det', 'num', 'particle'
  )
);

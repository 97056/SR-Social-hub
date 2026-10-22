UPDATE theme_settings
SET brand_name = 'SR Social hub', updated_at = now()
WHERE id = 1
  AND brand_name IN ('SocialLink', 'Northstar');

UPDATE legal_documents
SET body_markdown = replace(body_markdown, 'SocialLink', 'SR Social hub'), updated_at = now()
WHERE slug = 'terms' AND body_markdown LIKE '%SocialLink%';

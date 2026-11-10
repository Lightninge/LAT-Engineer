-- Run in Supabase: SQL Editor -> New query -> paste -> Run
create table profiles(id uuid primary key references auth.users on delete cascade, full_name text, role text not null default 'medewerker' check (role in ('beheerder','werkvoorbereider','medewerker')));
create table projects(id uuid primary key default gen_random_uuid(), number text unique not null, name text not null, client text, location text, notes text, status text not null default 'actief', created_by uuid references auth.users, created_at timestamptz default now());
create table rules(id uuid primary key default gen_random_uuid(), phase int not null check (phase between 1 and 5), category text not null, title text not null, sort int not null, module text, required boolean not null default true, active boolean not null default true);
create table project_modules(project_id uuid references projects on delete cascade, module text, active boolean not null default true, primary key(project_id,module));
create table project_items(id uuid primary key default gen_random_uuid(), project_id uuid not null references projects on delete cascade, rule_id uuid not null references rules, status text not null default 'open' check (status in ('open','bezig','klaar','nvt')), done_by uuid references auth.users, done_at timestamptz, updated_by uuid references auth.users, updated_at timestamptz, comment text, unique(project_id,rule_id));
create table activity(id bigserial primary key, project_id uuid references projects on delete cascade, user_id uuid references auth.users, action text, detail text, created_at timestamptz default now());

-- first registered user becomes beheerder, the rest medewerker
create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,full_name,role) values(new.id,new.email,case when (select count(*) from profiles)=0 then 'beheerder' else 'medewerker' end); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
create function my_role() returns text language sql stable security definer set search_path=public as $$ select role from profiles where id=auth.uid() $$;

alter table profiles enable row level security; alter table projects enable row level security; alter table rules enable row level security;
alter table project_modules enable row level security; alter table project_items enable row level security; alter table activity enable row level security;

create policy "read" on profiles for select to authenticated using (true);
create policy "admin update" on profiles for update to authenticated using (my_role()='beheerder');
create policy "read" on projects for select to authenticated using (true);
create policy "write" on projects for all to authenticated using (my_role() in ('beheerder','werkvoorbereider')) with check (my_role() in ('beheerder','werkvoorbereider'));
create policy "read" on rules for select to authenticated using (true);
create policy "admin write" on rules for all to authenticated using (my_role()='beheerder') with check (my_role()='beheerder');
create policy "read" on project_modules for select to authenticated using (true);
create policy "write" on project_modules for all to authenticated using (my_role() in ('beheerder','werkvoorbereider')) with check (my_role() in ('beheerder','werkvoorbereider'));
create policy "read" on project_items for select to authenticated using (true);
create policy "write" on project_items for all to authenticated using (true) with check (true);
create policy "read" on activity for select to authenticated using (true);
create policy "insert" on activity for insert to authenticated with check (user_id=auth.uid());

alter publication supabase_realtime add table project_items, project_modules;

-- Seed: base checklist (module = null) and additional checklist items per module
insert into rules(phase,category,title,sort,module) values
(1,'Administratie','Aanvraag schouw ontvangen',1,null),
(1,'Administratie','Projectnummer aanmaken',2,null),
(1,'Administratie','Projectmap aanmaken',3,null),
(1,'Administratie','Volledige plantekening opvragen en controleren',4,null),
(1,'Administratie','Beschikbare projectdocumentatie verzamelen',5,null),
(1,'Administratie','Controleren of alle benodigde informatie aanwezig is',6,null),
(2,'Voorbereiding schouw','KLIC-melding aanvragen',7,null),
(2,'Voorbereiding schouw','KLIC-gegevens en tekeningen controleren',8,null),
(2,'Voorbereiding schouw','Tekeningen printen en digitaal inlezen',9,null),
(2,'Voorbereiding schouw','Oriëntatie-KLIC beschikbaar maken voor de schouw',10,null),
(2,'Voorbereiding schouw','Benodigde projectinformatie voorbereiden',11,null),
(2,'Schouw: tracé en bestaande situatie','Controleren of juiste plantekeningen en KLIC-informatie aanwezig zijn',12,null),
(2,'Schouw: tracé en bestaande situatie','Gepland tracé buiten nalopen en controleren',13,null),
(2,'Schouw: tracé en bestaande situatie','Ligging van bestaande kabels en leidingen controleren',14,null),
(2,'Schouw: tracé en bestaande situatie','Kruisingen met kabels, leidingen, wegen en obstakels inventariseren',15,null),
(2,'Schouw: tracé en bestaande situatie','Bereikbaarheid voor personeel en materieel beoordelen',16,null),
(2,'Schouw: tracé en bestaande situatie','Bijzonderheden en afwijkingen vastleggen',17,null),
(2,'Schouw: technische aandachtspunten','Controleren of tracé technisch uitvoerbaar is',18,null),
(2,'Schouw: technische aandachtspunten','Locaties voor boringen, nanodrills, boogzinkers of persingen inventariseren',19,null),
(2,'Schouw: technische aandachtspunten','Controleren of zandzuigen noodzakelijk is',20,null),
(2,'Schouw: technische aandachtspunten','Locaties voor proefsleuven inventariseren',21,null),
(2,'Schouw: technische aandachtspunten','Obstakels en knelpunten in de ondergrond vastleggen',22,null),
(2,'Schouw: omgeving en logistiek','Betrokken beheerders en partijen inventariseren (Gasunie, TenneT, ProRail, RWS)',23,null),
(2,'Schouw: omgeving en logistiek','Mogelijkheden voor tijdelijke opslag bepalen',24,null),
(2,'Schouw: omgeving en logistiek','Ruimte voor tijdelijke verkeersmaatregelen beoordelen',25,null),
(2,'Schouw: omgeving en logistiek','Fasering en uitvoeringsvolgorde op locatie beoordelen',26,null),
(2,'Schouw: vastleggen en afronding','Foto''s maken van tracé, kruisingen en bijzondere situaties',27,null),
(2,'Schouw: vastleggen en afronding','Aandachtspunten en risico''s noteren',28,null),
(2,'Schouw: vastleggen en afronding','Openstaande punten vertalen naar actiepunten',29,null),
(2,'Schouw: vastleggen en afronding','Input verzamelen voor schouwverslag en actielijst',30,null),
(2,'Actielijst opstellen','Haalbaarheid van uitvoeringsmethodes onderzoeken',31,null),
(2,'Actielijst opstellen','Offertes voor inkoop en verkoop aanvragen',32,null),
(2,'Actielijst opstellen','Fasering van de werkzaamheden bepalen',33,null),
(2,'Actielijst opstellen','Opslagterrein bepalen',34,null),
(2,'Actielijst opstellen','Extra schouwen of VO1''s organiseren wanneer nodig',35,null),
(3,'Uitwerking','Actielijst controleren en openstaande acties bewaken',36,null),
(3,'Uitwerking','Technische haalbaarheid en uitvoeringsmethodes bevestigen',37,null),
(3,'Uitwerking','Benodigde wijzigingen verwerken in de plantekening',38,null),
(3,'Uitwerking','Aangepaste tekening opstellen',39,null),
(3,'Uitwerking','Tekening controleren op volledigheid en uitvoerbaarheid',40,null),
(4,'Aanvraag planning','Gehele werk inplannen',41,null),
(4,'Aanvraag planning','Uitvoeringsvolgorde en fasering bepalen',42,null),
(4,'Aanvraag planning','Werk melden bij verkeersafdelingen van gemeentes',43,null),
(4,'Aanvraag planning','Planning en fasering controleren en afstemmen',44,null),
(4,'Aanvraag planning','Voorcalculatie opstellen',45,null),
(4,'Aanvraag planning','Voorcalculatie verwerken in VC Excel',46,null),
(5,'Werkmap compleet maken','Werkplannen aanvragen bij WV',47,null),
(5,'Werkmap compleet maken','Controleren of alle documenten aanwezig en actueel zijn',48,null),
(5,'Werkmap compleet maken','Controleren of de opdracht volledig en correct is geaccepteerd',49,null),
(5,'Administratieve verwerking','Voorcalculatie inlezen in 4PS',50,null),
(5,'Administratieve verwerking','Bestelling inlezen in 4PS',51,null),
(5,'Administratieve verwerking','VC en bestelling controleren',52,null),
(5,'Administratieve verwerking','Afwijkingen doorgeven aan de projectcoördinator',53,null),
(5,'Warme overdracht','Warme overdracht met werkvoorbereider organiseren',54,null),
(5,'Warme overdracht','Warme overdracht met uitvoerder organiseren',55,null),
(5,'Warme overdracht','Openstaande acties en risico''s overdragen',56,null),
(2,'Aanvullend: boomcheck','Aanwezige bomen inventariseren',57,'boomcheck'),
(2,'Aanvullend: boomcheck','Kwetsbare boomzones controleren',58,'boomcheck'),
(2,'Aanvullend: boomcheck','Boombeschermingsmaatregelen bepalen',59,'boomcheck'),
(2,'Aanvullend: boomcheck','Maatregelen verwerken in aangepaste tekening',60,'boomcheck'),
(2,'Aanvullend: boomcheck','Boombescherming controleren tijdens eindcontrole',61,'boomcheck'),
(2,'Aanvullend: boringen','Locaties voor boringen inventariseren',62,'boringen'),
(2,'Aanvullend: boringen','Technische haalbaarheid boringen onderzoeken',63,'boringen'),
(2,'Aanvullend: boringen','In- en uittredepunten bepalen',64,'boringen'),
(2,'Aanvullend: boringen','Benodigde offertes boringen aanvragen',65,'boringen'),
(4,'Aanvullend: planning','Boringen inplannen',66,'boringen'),
(2,'Aanvullend: nanodrills','Haalbaarheid nanodrills onderzoeken',67,'nanodrills'),
(4,'Aanvullend: planning','Nanodrills inplannen',68,'nanodrills'),
(2,'Aanvullend: boogzinkers','Haalbaarheid boogzinkers onderzoeken',69,'boogzinkers'),
(4,'Aanvullend: planning','Zinkers inplannen',70,'boogzinkers'),
(2,'Aanvullend: persingen','Haalbaarheid persingen onderzoeken',71,'persingen'),
(2,'Aanvullend: zandzuigen','Haalbaarheid zandzuigen onderzoeken',72,'zandzuigen'),
(2,'Aanvullend: proefsleuven','Locaties voor proefsleuven bepalen en uitzetten',73,'proefsleuven'),
(2,'Aanvullend: verkeer','Verkeersplannen aanvragen',74,'verkeersplannen'),
(4,'Aanvullend: planning','Benodigde meldingen via Melvin verzorgen',75,'verkeersplannen'),
(4,'4.2 VO2 met Liander','VO2 met Liander voorbereiden en uitvoeren',76,'vo2'),
(4,'4.2 VO2 met Liander','VO2-checklist volledig doorlopen',77,'vo2'),
(4,'4.2 VO2 met Liander','Afspraken en actiepunten vastleggen',78,'vo2'),
(4,'4.2 VO2 met Liander','Schouwverslag updaten',79,'vo2'),
(4,'4.2 VO2 met Liander','Actielijst bijwerken',80,'vo2'),
(2,'Aanvullend: vGIS','vGIS-project aanmaken en documenten inladen',81,'vgis');

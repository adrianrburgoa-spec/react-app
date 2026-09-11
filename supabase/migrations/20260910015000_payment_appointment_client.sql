alter table public.appointments
  add constraint appointments_id_client_owner_unique unique (id, client_id, owner_id);

alter table public.payments drop constraint payments_appointment_fk;
alter table public.payments add constraint payments_appointment_client_fk
  foreign key (appointment_id, client_id, owner_id)
  references public.appointments(id, client_id, owner_id)
  on update cascade on delete restrict;

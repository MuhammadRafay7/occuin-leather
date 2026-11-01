import { startTransition, type FormEvent } from "react";

export const submitInPlace = (action: (data: FormData) => void) => (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  startTransition(() => action(data));
};

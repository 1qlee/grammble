import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { Description } from "@headlessui/react";
import Input from "~/components/ui/forms/Input";
import Label from "~/components/ui/forms/Label";
import Field from "~/components/ui/forms/Field";
import Button from "~/components/buttons/Button";

const { fieldContext, formContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {
    Input,
    Description,
    Label,
    Field,
  },
  formComponents: {
    Button,
  },
  fieldContext,
  formContext,
});

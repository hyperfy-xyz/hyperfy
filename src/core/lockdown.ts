lockdown({
  // TODO: in production we may want to flip these
  // but for now this lets us see errors during dev
  errorTaming: 'unsafe',
  errorTrapping: 'report',
  unhandledRejectionTrapping: 'report',

  // Make lockdown more permissive to avoid React DOM conflicts
  regExpTaming: 'unsafe',
  localeTaming: 'unsafe',
  consoleTaming: 'unsafe',
  evalTaming: 'unsafeEval',
  overrideTaming: 'min',
  domainTaming: 'unsafe',

  // this is needed for monaco to work correctly.
  // specifically the theming seems to be broken.
  // this shouldn't be an issue as we are not using harden()
  __hardenTaming__: 'unsafe',
})

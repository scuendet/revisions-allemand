export interface VerbGroup {
  id: string
  name: string
  description?: string
  verbs: string[]
  include_first_group_er: boolean
}

export const DEFAULT_VERBES_5P_GROUP: VerbGroup = {
  id: 'essential-verbs',
  name: 'Verbes 5P',
  description:
    'Les verbes essentiels incluent être, avoir, aller, faire, dire, venir, vouloir, pouvoir, et les verbes du 1er groupe (en -er).',
  verbs: ['être', 'avoir', 'aller', 'faire', 'dire', 'venir', 'vouloir', 'pouvoir'],
  include_first_group_er: true,
}

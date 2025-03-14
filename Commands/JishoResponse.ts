// Generated automatically using https://transform.tools/js-object-to-typescript

export interface JishoResponse {
    meta: Meta
    data: Daum[]
}

export interface Meta {
    status: number
}

export interface Daum {
    slug: string
    is_common: boolean
    tags: string[]
    jlpt: string[]
    japanese: Japanese[]
    senses: Sense[]
    attribution: Attribution
}

export interface Japanese {
    word?: string
    reading: string
}

export interface Sense {
    english_definitions: string[]
    parts_of_speech: string[]
    links: Link[]
    tags: string[]
    restrictions: any[]
    see_also: string[]
    antonyms: any[]
    source: any[]
    info: string[]
    sentences?: any[]
}

export interface Link {
    text: string
    url: string
}

export interface Attribution {
    jmdict: boolean
    jmnedict: boolean
    dbpedia: any
}

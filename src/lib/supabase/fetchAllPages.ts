const DEFAULT_PAGE_SIZE = 1000

interface PageResult<T> {
    data: T[] | null
    error: Error | null
}

export async function fetchAllPages<T>(
    fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
    pageSize = DEFAULT_PAGE_SIZE
): Promise<T[]> {
    const allRows: T[] = []
    let from = 0

    while (true) {
        const { data, error } = await fetchPage(from, from + pageSize - 1)
        if (error) throw error

        const rows = data || []
        allRows.push(...rows)

        if (rows.length < pageSize) {
            break
        }

        from += pageSize
    }

    return allRows
}

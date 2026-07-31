import PayPage from "../page";

export default async function PaySlugPage(props: { params: Promise<{ slug?: string[] }> }) {
    const params = await props.params;
    return <PayPage slugParams={params?.slug} />;
}

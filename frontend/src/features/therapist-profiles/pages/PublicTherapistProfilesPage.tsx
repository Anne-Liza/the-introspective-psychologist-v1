import { useQuery } from "@tanstack/react-query";
import { ArrowRight, HeartHandshake } from "lucide-react";
import { Link } from "react-router";

import { DataState } from "../../../components/data/DataState";
import { TherapistProfileCard } from "../components/TherapistProfileCard";
import { fetchPublicTherapistProfiles } from "../lib/therapistProfilesApi";

export function PublicTherapistProfilesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-therapist-profiles"],
    queryFn: fetchPublicTherapistProfiles,
  });

  const showState = isLoading || isError || !data?.length;

  return (
    <main data-ui-contract="public.therapists" className="bg-[#fbfaf5]">
      <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6f7f52]">
            Therapy practice
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-tight tracking-[-0.03em] text-[#26311f] md:text-6xl">
            Meet our therapists.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#59654d]">
            Learn about each therapist’s professional focus, approach, languages, location, and available session formats.
          </p>
          </div>
          <aside className="rounded-[2rem] border border-[#dce3d3] bg-white p-7 lg:justify-self-end">
            <HeartHandshake className="h-6 w-6 text-[#6f7f52]" aria-hidden="true" />
            <h2 className="mt-4 font-serif text-2xl text-[#26311f]">Choosing a therapist is personal.</h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-[#59654d]">Profiles help you orient yourself. The practice can also help match your request with an appropriate available therapist.</p>
          </aside>
        </div>

        <div className="mt-12">
          {showState ? (
            <DataState isLoading={isLoading} isError={isError} empty={!data?.length} />
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {data?.map((profile) => (
                <TherapistProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </div>

        <section className="mt-20 rounded-[2.5rem] bg-[#edf2e7] p-8 md:flex md:items-center md:justify-between md:p-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6f7f52]">Finding a fit</p>
            <h2 className="mt-4 font-serif text-4xl text-[#26311f]">You can request a therapist—or ask the practice to help choose.</h2>
            <p className="mt-4 text-sm leading-7 text-[#59654d]">Allocation is only confirmed after the practice checks service fit, session format, and actual availability.</p>
          </div>
          <Link to="/book" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#26311f] px-6 py-3 text-sm font-semibold text-white md:mt-0">Request an appointment <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </section>
    </main>
  );
}

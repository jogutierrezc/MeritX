import { DbConnection } from '../module_bindings';
import type { AcademicProgram, Faculty } from '../module_bindings/types';
import { getSpacetimeConnectionConfig } from '../services/spacetime';
import type { ConvocatoriaType } from './convocatoria_table';

type ApiConfigRow = {
  configKey: string;
  scopusApiKey?: string;
  orcidClientId?: string;
  orcidClientSecret?: string;
};

let sharedConnection: DbConnection | null = null;

const getSharedConnection = () => {
  if (sharedConnection) return sharedConnection;
  const { host, databaseName } = getSpacetimeConnectionConfig();
  sharedConnection = DbConnection.builder()
    .withUri(host)
    .withDatabaseName(databaseName)
    .build();
  return sharedConnection;
};

const readApiConfigFromCache = (connection: DbConnection): ApiConfigRow[] => {
  const dbView = connection.db as any;
  const apiTable = dbView.apiConfig || dbView.api_config;
  return apiTable ? (Array.from(apiTable.iter()) as ApiConfigRow[]) : [];
};

const readConvocatoriasFromCache = (connection: DbConnection): ConvocatoriaType[] => {
  const dbView = connection.db as any;
  const convTable = dbView.convocatoria || dbView.convocatorias;
  return convTable ? (Array.from(convTable.iter()) as ConvocatoriaType[]) : [];
};

const readFacultyProgramCatalogFromCache = (
  connection: DbConnection,
): { faculties: Faculty[]; programs: AcademicProgram[] } => {
  const dbView = connection.db as any;
  const facultyTable = dbView.faculty;
  const programTable = dbView.academic_program || dbView.academicProgram;
  const faculties = facultyTable ? (Array.from(facultyTable.iter()) as Faculty[]) : [];
  const programs = programTable ? (Array.from(programTable.iter()) as AcademicProgram[]) : [];
  return { faculties, programs };
};

/**
 * One-shot load for api_config table.
 * Keeps network usage low by unsubscribing immediately after first snapshot.
 */
export const fetchApiConfigOnce = async (): Promise<ApiConfigRow[]> => {
  const connection = getSharedConnection();

  return await new Promise<ApiConfigRow[]>((resolve, reject) => {
    let settled = false;
    const finish = (value: ApiConfigRow[], unsubscribe?: { unsubscribe: () => void }) => {
      if (settled) return;
      settled = true;
      unsubscribe?.unsubscribe();
      resolve(value);
    };

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        finish(readApiConfigFromCache(connection), subscription);
      })
      .onError((ctx: unknown) => {
        if (settled) return;
        settled = true;
        subscription.unsubscribe();
        reject(ctx);
      })
      .subscribe(['SELECT * FROM api_config']);
  });
};

/**
 * One-shot load for convocatoria table.
 * Call this on initial page load and explicitly after create/edit actions.
 */
export const fetchConvocatoriasOnce = async (): Promise<ConvocatoriaType[]> => {
  const connection = getSharedConnection();

  return await new Promise<ConvocatoriaType[]>((resolve, reject) => {
    let settled = false;
    const finish = (value: ConvocatoriaType[], unsubscribe?: { unsubscribe: () => void }) => {
      if (settled) return;
      settled = true;
      unsubscribe?.unsubscribe();
      resolve(value);
    };

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(() => {
        finish(readConvocatoriasFromCache(connection), subscription);
      })
      .onError((ctx: unknown) => {
        if (settled) return;
        settled = true;
        subscription.unsubscribe();
        reject(ctx);
      })
      .subscribe(['SELECT * FROM convocatoria']);
  });
};

/**
 * One-shot load for faculty/program catalog.
 */
export const fetchFacultyProgramsOnce = async (): Promise<{
  faculties: Faculty[];
  programs: AcademicProgram[];
}> => {
  const connection = getSharedConnection();

  return await new Promise<{ faculties: Faculty[]; programs: AcademicProgram[] }>(
    (resolve, reject) => {
      let settled = false;
      const finish = (
        value: { faculties: Faculty[]; programs: AcademicProgram[] },
        unsubscribe?: { unsubscribe: () => void },
      ) => {
        if (settled) return;
        settled = true;
        unsubscribe?.unsubscribe();
        resolve(value);
      };

      const subscription = connection
        .subscriptionBuilder()
        .onApplied(() => {
          finish(readFacultyProgramCatalogFromCache(connection), subscription);
        })
        .onError((ctx: unknown) => {
          if (settled) return;
          settled = true;
          subscription.unsubscribe();
          reject(ctx);
        })
        .subscribe(['SELECT * FROM faculty', 'SELECT * FROM academic_program']);
    },
  );
};

export const disconnectSharedSubscriptionsConnection = () => {
  if (!sharedConnection) return;
  sharedConnection.disconnect();
  sharedConnection = null;
};

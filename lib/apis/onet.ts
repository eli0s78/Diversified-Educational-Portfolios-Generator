/**
 * O*NET Web Services API v2.0 Client
 *
 * Free tier: 20 calls/minute (register at https://services.onetcenter.org/register)
 * Docs: https://services.onetcenter.org/reference/
 * Migration guide: https://services.onetcenter.org/reference/start/migration
 */

const BASE_URL = "https://api-v2.onetcenter.org";

export interface ONETOccupationDetails {
  code: string;
  title: string;
  description: string;
}

export interface ONETSkill {
  id: string; // v2.0: changed from element_id
  name: string; // v2.0: changed from element_name
  description?: string;
  importance: number; // v2.0: changed from data_value
  related?: string; // v2.0: URL to related occupations
}

export interface ONETTechnology {
  title: string; // v2.0: changed from example_name
  percentage?: number; // v2.0: usage percentage
  hot_technology?: boolean; // v2.0: changed from string to boolean
  in_demand?: boolean; // v2.0: new field
}

export interface ONETWorkActivity {
  id: string; // v2.0: changed from element_id
  name: string; // v2.0: changed from element_name
  description?: string;
  importance: number; // v2.0: changed from data_value
  related?: string; // v2.0: URL to related occupations
}

export interface ONETKnowledge {
  id: string; // v2.0: changed from element_id
  name: string; // v2.0: changed from element_name
  description?: string;
  importance: number; // v2.0: changed from data_value
  related?: string; // v2.0: URL to related occupations
}

/**
 * Search for occupations by keyword (v2.0)
 */
export async function searchONETOccupations(
  keyword: string,
  apiKey: string
): Promise<ONETOccupationDetails[]> {
  const url = `${BASE_URL}/online/search?keyword=${encodeURIComponent(keyword)}`;

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`O*NET API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.occupation || [];
}

/**
 * Get skills for an occupation (v2.0)
 */
export async function getONETSkills(
  onetCode: string,
  apiKey: string
): Promise<ONETSkill[]> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/details/skills`;

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`O*NET API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.element || [];
}

/**
 * Get technology skills for an occupation (v2.0)
 */
export async function getONETTechnology(
  onetCode: string,
  apiKey: string
): Promise<ONETTechnology[]> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/summary/technology_skills`;

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`O*NET API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const categories = data.category || [];

  // Flatten all technology examples (v2.0: category[].example[])
  const allTech: ONETTechnology[] = [];
  for (const category of categories) {
    if (category.example) {
      allTech.push(...category.example);
    }
  }

  return allTech;
}

/**
 * Get work activities for an occupation (v2.0)
 */
export async function getONETWorkActivities(
  onetCode: string,
  apiKey: string
): Promise<ONETWorkActivity[]> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/details/work_activities`;

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`O*NET API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.element || [];
}

/**
 * Get knowledge requirements for an occupation (v2.0)
 */
export async function getONETKnowledge(
  onetCode: string,
  apiKey: string
): Promise<ONETKnowledge[]> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/details/knowledge`;

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`O*NET API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.element || [];
}

/**
 * Get occupation details (v2.0)
 */
export async function getONETOccupationDetails(
  onetCode: string,
  apiKey: string
): Promise<ONETOccupationDetails> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/`;

  const response = await fetch(url, {
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`O*NET API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

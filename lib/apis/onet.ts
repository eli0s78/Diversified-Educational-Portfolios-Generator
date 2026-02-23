/**
 * O*NET Web Services API Client
 *
 * Free tier: 20 calls/minute (register at https://services.onetcenter.org/register)
 * Docs: https://services.onetcenter.org/reference/
 */

const BASE_URL = "https://services.onetcenter.org/ws";

export interface ONETOccupationDetails {
  code: string;
  title: string;
  description: string;
}

export interface ONETSkill {
  element_id: string;
  element_name: string;
  scale_id: string;
  data_value: number; // Importance or Level
  description?: string;
}

export interface ONETTechnology {
  example_name: string;
  commodity_code?: string;
  hot_technology?: string;
}

export interface ONETWorkActivity {
  element_id: string;
  element_name: string;
  scale_id: string;
  data_value: number;
}

export interface ONETKnowledge {
  element_id: string;
  element_name: string;
  scale_id: string;
  data_value: number;
  description?: string;
}

/**
 * Search for occupations by keyword
 */
export async function searchONETOccupations(
  keyword: string,
  apiKey: string
): Promise<ONETOccupationDetails[]> {
  const url = `${BASE_URL}/online/search?keyword=${encodeURIComponent(keyword)}`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Accept": "application/json",
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
 * Get skills for an occupation
 */
export async function getONETSkills(
  onetCode: string,
  apiKey: string
): Promise<ONETSkill[]> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/summary/skills`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Accept": "application/json",
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
 * Get technology skills for an occupation
 */
export async function getONETTechnology(
  onetCode: string,
  apiKey: string
): Promise<ONETTechnology[]> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/summary/technology`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`O*NET API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const categories = data.technology || [];

  // Flatten all technology examples
  const allTech: ONETTechnology[] = [];
  for (const category of categories) {
    if (category.example) {
      allTech.push(...category.example);
    }
  }

  return allTech;
}

/**
 * Get work activities for an occupation
 */
export async function getONETWorkActivities(
  onetCode: string,
  apiKey: string
): Promise<ONETWorkActivity[]> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/summary/work_activities`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Accept": "application/json",
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
 * Get knowledge requirements for an occupation
 */
export async function getONETKnowledge(
  onetCode: string,
  apiKey: string
): Promise<ONETKnowledge[]> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}/summary/knowledge`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Accept": "application/json",
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
 * Get occupation details
 */
export async function getONETOccupationDetails(
  onetCode: string,
  apiKey: string
): Promise<ONETOccupationDetails> {
  const url = `${BASE_URL}/online/occupations/${encodeURIComponent(onetCode)}`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`O*NET API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

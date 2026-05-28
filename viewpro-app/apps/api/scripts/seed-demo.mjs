import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argon2id, hash } from "argon2";
import {
	AnalyticsActorType,
	AnalyticsEventName,
	DocumentRequestStatus,
	DocumentVersionStatus,
	GlobalRole,
	InterestLevel,
	MovementSource,
	MovementType,
	PrismaClient,
	PropertyAssetOwnerAccessStatus,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(apiRoot, "../..");

loadEnvFile(resolve(workspaceRoot, ".env"));
loadEnvFile(resolve(apiRoot, ".env"));
loadEnvFile(resolve(process.cwd(), ".env"));

const DEMO_TENANT_SLUG = "viewpro-demo-inmobiliaria";
const DEMO_TENANT_NAME = "ViewPro Demo Inmobiliaria";
const DEMO_PASSWORD =
	process.env.VIEWPRO_DEMO_PASSWORD ?? buildDefaultDemoPassword();
const DEMO_USERS = [
	{
		email: "demo@viewpro.local",
		firstName: "Demo",
		lastName: "ViewPro",
		role: TenantRole.PRINCIPAL_MANAGER,
	},
	{
		email: "sofia.demo@viewpro.local",
		firstName: "Sofía",
		lastName: "Demo",
		role: TenantRole.MANAGER,
	},
	{
		email: "martin.demo@viewpro.local",
		firstName: "Martín",
		lastName: "Demo",
		role: TenantRole.AGENT,
	},
	{
		email: "lucia.demo@viewpro.local",
		firstName: "Lucía",
		lastName: "Demo",
		role: TenantRole.AGENT,
	},
];
const DEMO_OWNER_EMAIL = "propietario.demo@viewpro.local";
const DEMO_OWNER_USER = {
	email: DEMO_OWNER_EMAIL,
	firstName: "Propietario",
	lastName: "Demo",
};
const DEMO_AUTH_USERS = [...DEMO_USERS, DEMO_OWNER_USER];

const DEMO_USER_EMAILS = DEMO_AUTH_USERS.map((user) => user.email);
const DOCUMENT_TITLES = [
	"Escritura",
	"Plano municipal",
	"Impuesto municipal",
	"DNI del propietario",
	"Reglamento de copropiedad",
	"Estado de expensas",
];
const DOCUMENT_STORAGE_PREFIX = "document-requests";
const PROPERTY_IMAGES_STORAGE_PREFIX = "property-images";
const DEMO_IMAGE_DOWNLOAD_TIMEOUT_MS = 10_000;
const DEMO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROPERTY_IMAGE_MIME_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/webp",
]);
const DEMO_PROPERTY_IMAGE_URLS = [
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/54/42/87/720x532/2037832325.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/57/89/72/91/720x532/2019918989.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/55/13/87/27/720x532/1949085025.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/56/58/29/19/720x532/1984602211.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/90/52/92/720x532/2047521926.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/95/74/26/720x532/2048834734.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/90/42/88/720x532/2047495125.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/56/75/53/85/720x532/1989404810.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/74/85/42/720x532/2043397315.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/78/43/07/720x532/2044355302.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/45/53/68/720x532/2035382892.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/98/99/61/720x532/2049638075.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/52/51/98/72/720x532/1885545456.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/90/74/70/720x532/2047574905.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/77/26/29/720x532/2044067568.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/81/69/19/720x532/2045191369.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/50/27/18/720x532/2036680501.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/58/06/36/24/720x532/2051566893.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/57/45/69/62/720x532/2008689362.jpg?isFirstImage=true",
	],
	[
		"https://imgar.zonapropcdn.com/avisos/1/00/57/40/27/14/720x532/2047394923.jpg?isFirstImage=true",
	],
];

const DEMO_PROPERTIES = [
	{
		title: "Casa familiar con pileta en Villa Centenario",
		addressLine: "Villa Centenario",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 125000,
		totalAreaSqm: 360,
		coveredAreaSqm: 231,
		rooms: 7,
		bedrooms: 6,
		bathrooms: 2,
		garages: 2,
		ageYears: 25,
		orientation: "N",
	},
	{
		title: "Casa luminosa con patio en Los Boulevares",
		addressLine: "Los Boulevares",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		currency: "USD",
		price: 85000,
		totalAreaSqm: 255,
		coveredAreaSqm: 120,
		rooms: 4,
		bedrooms: 3,
		bathrooms: 1,
		garages: 2,
		ageYears: 20,
	},
	{
		title: "Casa premium en Cerro de las Rosas",
		addressLine: "Cerro de las Rosas",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.OFFER_NEGOTIATION,
		currency: "USD",
		price: 450000,
		totalAreaSqm: 1610,
		coveredAreaSqm: 493,
		rooms: 6,
		bedrooms: 3,
		bathrooms: 4,
		garages: 4,
		ageYears: 40,
	},
	{
		title: "Casa en barrio privado Pilara",
		addressLine: "Pilara",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.PUBLICATION_PREPARATION,
		currency: "USD",
		price: 600000,
		totalAreaSqm: 792,
		coveredAreaSqm: 280,
		rooms: 6,
		bedrooms: 4,
		bathrooms: 3,
		garages: 2,
	},
	{
		title: "Casa con galería en La Lomada",
		addressLine: "La Lomada",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 610000,
		totalAreaSqm: 830,
		coveredAreaSqm: 320,
		rooms: 7,
		bedrooms: 5,
		bathrooms: 3,
		garages: 6,
		ageYears: 20,
		orientation: "NE",
	},
	{
		title: "Casa moderna en El Cantón Norte",
		addressLine: "El Cantón Norte",
		city: "Escobar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		currency: "USD",
		price: 265000,
		totalAreaSqm: 216,
		coveredAreaSqm: 176,
		rooms: 5,
		bedrooms: 3,
		bathrooms: 2,
		garages: 1,
		ageYears: 4,
		orientation: "O",
	},
	{
		title: "Casa para refaccionar en Mapuche",
		addressLine: "Mapuche Country Club",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.CAPTURE,
		currency: "USD",
		price: 170000,
		totalAreaSqm: 650,
		coveredAreaSqm: 113,
		rooms: 5,
		bedrooms: 2,
		bathrooms: 3,
		garages: 6,
	},
	{
		title: "Dúplex apto crédito en Villa Cabrera",
		addressLine: "Villa Cabrera",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.DOCUMENTATION_PENDING,
		currency: "USD",
		price: 119000,
		totalAreaSqm: 140,
		coveredAreaSqm: 140,
		rooms: 5,
		bedrooms: 4,
		bathrooms: 2,
		garages: 1,
		ageYears: 40,
		orientation: "S",
	},
	{
		title: "Casa con jardín en Villa Catalina",
		addressLine: "Villa Catalina",
		city: "Río Ceballos",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 195000,
		totalAreaSqm: 250,
		coveredAreaSqm: 150,
		rooms: 7,
		bedrooms: 3,
		bathrooms: 2,
		garages: 2,
		ageYears: 5,
	},
	{
		title: "Casa de diseño en Los Olivares",
		addressLine: "Los Olivares",
		city: "Malvinas Argentinas",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		currency: "USD",
		price: 290000,
		totalAreaSqm: 230,
		coveredAreaSqm: 191,
		rooms: 7,
		bedrooms: 4,
		bathrooms: 2,
		garages: 2,
		ageYears: 5,
		orientation: "NO",
	},
	{
		title: "Housing a estrenar en La Carolina",
		addressLine: "La Carolina",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.PUBLICATION_PREPARATION,
		currency: "USD",
		price: 320000,
		totalAreaSqm: 360,
		coveredAreaSqm: 270,
		rooms: 5,
		bedrooms: 3,
		bathrooms: 3,
		garages: 2,
	},
	{
		title: "Casa quinta en barrio Freixas",
		addressLine: "Freixas",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		currency: "USD",
		price: 490000,
		totalAreaSqm: 4000,
		coveredAreaSqm: 210,
		rooms: 4,
		bedrooms: 2,
		bathrooms: 2,
		garages: 2,
		ageYears: 4,
		orientation: "N",
	},
	{
		title: "Casa en Barrio Puerto El Cantón",
		addressLine: "El Cantón Puerto",
		city: "Escobar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 275000,
		totalAreaSqm: 220,
		coveredAreaSqm: 165,
		rooms: 5,
		bedrooms: 3,
		bathrooms: 2,
		garages: 2,
		ageYears: 5,
		orientation: "SE",
	},
	{
		title: "Casa amplia en Los Laureles",
		addressLine: "Los Laureles",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.OFFER_NEGOTIATION,
		currency: "USD",
		price: 480000,
		totalAreaSqm: 1080,
		coveredAreaSqm: 320,
		rooms: 6,
		bedrooms: 5,
		bathrooms: 4,
		garages: 4,
	},
	{
		title: "Casa de categoría en Farm Club",
		addressLine: "Farm Club",
		city: "Pilar",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "USD",
		price: 1100000,
		totalAreaSqm: 3740,
		coveredAreaSqm: 619,
		rooms: 8,
		bedrooms: 5,
		bathrooms: 5,
		garages: 6,
		ageYears: 25,
		orientation: "NO",
	},
	{
		title: "Departamento con balcón en Nueva Córdoba",
		addressLine: "Nueva Córdoba",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.APARTMENT,
		operationType: PropertyOperationType.RENT,
		status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		currency: "ARS",
		price: 650000,
		totalAreaSqm: 78,
		coveredAreaSqm: 72,
		rooms: 3,
		bedrooms: 2,
		bathrooms: 2,
		garages: 1,
		ageYears: 8,
	},
	{
		title: "Lote residencial en zona norte",
		addressLine: "Zona Norte",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.LAND,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.CAPTURE,
		currency: "USD",
		price: 72000,
		totalAreaSqm: 500,
	},
	{
		title: "Local comercial sobre avenida",
		addressLine: "Av. Colón",
		city: "Córdoba",
		province: "Córdoba",
		propertyType: PropertyType.COMMERCIAL,
		operationType: PropertyOperationType.RENT,
		status: PropertyEngagementStatus.FINAL_DOCUMENTATION,
		currency: "ARS",
		price: 950000,
		totalAreaSqm: 110,
		coveredAreaSqm: 110,
		bathrooms: 1,
		ageYears: 12,
	},
	{
		title: "PH reciclado en San Fernando",
		addressLine: "Victoria",
		city: "San Fernando",
		province: "Buenos Aires",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.DOCUMENTATION_PENDING,
		currency: "USD",
		price: 158000,
		totalAreaSqm: 160,
		coveredAreaSqm: 130,
		rooms: 4,
		bedrooms: 3,
		bathrooms: 2,
		garages: 1,
		ageYears: 18,
	},
	{
		title: "Casa compacta en Funes",
		addressLine: "Paseo del Norte",
		city: "Funes",
		province: "Santa Fe",
		propertyType: PropertyType.HOUSE,
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.PUBLICATION_PREPARATION,
		currency: "USD",
		price: 125000,
		totalAreaSqm: 180,
		coveredAreaSqm: 96,
		rooms: 4,
		bedrooms: 2,
		bathrooms: 2,
		garages: 1,
	},
];

assertSafeEnvironment();

const prisma = new PrismaClient();

try {
	const result = await seedDemo(prisma);
	printSummary(result);
} catch (error) {
	console.error("Demo seed failed.");
	console.error(error);
	process.exitCode = 1;
} finally {
	await prisma.$disconnect();
}

async function seedDemo(client) {
	await resetDemoTenant(client);
	const users = await createDemoUsers(client);
	const tenant = await createDemoTenant(client, users);
	const properties = await createDemoProperties(client, tenant, users);
	const images = await createDemoPropertyImages(client, tenant, properties);
	const movements = await createDemoMovements(
		client,
		tenant,
		users,
		properties,
	);
	const documentRequests = await createDemoDocumentRequests(
		client,
		tenant,
		users,
		properties,
	);

	return {
		tenant,
		propertiesCount: properties.length,
		imagesCount: images.length,
		movementsCount: movements.length,
		documentRequestsCount: documentRequests.length,
	};
}

async function resetDemoTenant(client) {
	const existingTenant = await client.tenant.findUnique({
		where: { slug: DEMO_TENANT_SLUG },
		select: { id: true },
	});

	const existingDemoUsers = await client.user.findMany({
		where: { email: { in: DEMO_USER_EMAILS } },
		select: { id: true, email: true },
	});
	const demoUserIds = existingDemoUsers.map((user) => user.id);

	if (existingTenant) {
		const engagements = await client.propertyEngagement.findMany({
			where: { tenantId: existingTenant.id },
			select: { id: true, propertyAssetId: true },
		});
		const engagementIds = engagements.map((engagement) => engagement.id);
		const assetIds = [
			...new Set(engagements.map((engagement) => engagement.propertyAssetId)),
		];

		await removeDemoImageFiles(existingTenant.id);
		await removeDemoDocumentFiles(client, existingTenant.id);

		await client.$transaction([
			client.analyticsEvent.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.document.deleteMany({
				where: { documentRequest: { tenantId: existingTenant.id } },
			}),
			client.documentRequest.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.movement.deleteMany({ where: { tenantId: existingTenant.id } }),
			client.propertyAgent.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.propertyEngagement.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			...(assetIds.length > 0
				? [
						client.propertyAssetOwner.deleteMany({
							where: { propertyAssetId: { in: assetIds } },
						}),
						client.propertyAssetImage.deleteMany({
							where: { propertyAssetId: { in: assetIds } },
						}),
						client.propertyAsset.deleteMany({
							where: { id: { in: assetIds } },
						}),
					]
				: []),
			...(engagementIds.length > 0
				? [
						client.analyticsEvent.deleteMany({
							where: { propertyEngagementId: { in: engagementIds } },
						}),
					]
				: []),
			client.tenantMembership.deleteMany({
				where: { tenantId: existingTenant.id },
			}),
			client.tenant.delete({ where: { id: existingTenant.id } }),
		]);
	}

	await deleteUnreferencedDemoUsers(client, demoUserIds);
}

async function deleteUnreferencedDemoUsers(client, demoUserIds) {
	for (const userId of demoUserIds) {
		const references = await Promise.all([
			client.tenantMembership.count({ where: { userId } }),
			client.refreshToken.count({ where: { userId } }),
			client.propertyAsset.count({ where: { createdByUserId: userId } }),
			client.propertyEngagement.count({ where: { createdByUserId: userId } }),
			client.propertyEngagement.count({ where: { archivedByUserId: userId } }),
			client.propertyAssetOwner.count({ where: { userId } }),
			client.propertyAgent.count({ where: { agentUserId: userId } }),
			client.propertyAgent.count({ where: { assignedByUserId: userId } }),
			client.movement.count({ where: { createdByUserId: userId } }),
			client.documentRequest.count({ where: { requestedByUserId: userId } }),
			client.documentRequest.count({ where: { ownerUserId: userId } }),
			client.documentRequest.count({ where: { reviewedByUserId: userId } }),
			client.documentVersion.count({ where: { uploadedByUserId: userId } }),
			client.propertyAssetImage.count({ where: { uploadedByUserId: userId } }),
			client.analyticsEvent.count({ where: { actorUserId: userId } }),
		]);

		if (references.every((count) => count === 0)) {
			await client.user.delete({ where: { id: userId } });
		}
	}
}

async function createDemoUsers(client) {
	const passwordHash = await hash(DEMO_PASSWORD, { type: argon2id });
	const users = new Map();

	for (const user of DEMO_AUTH_USERS) {
		const created = await client.user.upsert({
			where: { email: user.email },
			create: {
				email: user.email,
				passwordHash,
				firstName: user.firstName,
				lastName: user.lastName,
				status: UserStatus.ACTIVE,
				globalRole: GlobalRole.USER,
				emailVerifiedAt: new Date(),
			},
			update: {
				passwordHash,
				firstName: user.firstName,
				lastName: user.lastName,
				status: UserStatus.ACTIVE,
				emailVerifiedAt: new Date(),
			},
		});
		users.set(user.email, { ...created, role: user.role });
	}

	return users;
}

async function createDemoTenant(client, users) {
	const manager = users.get("demo@viewpro.local");

	return client.tenant
		.create({
			data: {
				name: DEMO_TENANT_NAME,
				slug: DEMO_TENANT_SLUG,
				status: TenantStatus.ACTIVE,
				memberships: {
					create: DEMO_USERS.map((user) => ({
						userId: users.get(user.email).id,
						role: user.role,
					})),
				},
			},
			include: {
				memberships: true,
			},
		})
		.then((tenant) => ({ ...tenant, manager }));
}

async function createDemoProperties(client, tenant, users) {
	const manager = users.get("demo@viewpro.local");
	const demoOwner = users.get(DEMO_OWNER_EMAIL);
	const sellers = [
		users.get("sofia.demo@viewpro.local"),
		users.get("martin.demo@viewpro.local"),
		users.get("lucia.demo@viewpro.local"),
	];
	const createdProperties = [];

	for (const [index, property] of DEMO_PROPERTIES.entries()) {
		const seller = sellers[index % sellers.length];
		const isDemoOwnerProperty = index === 0;
		const ownerEmail = isDemoOwnerProperty
			? DEMO_OWNER_EMAIL
			: `propietario-${index + 1}@viewpro.local`;
		const ownerName = isDemoOwnerProperty
			? `${demoOwner.firstName} ${demoOwner.lastName}`
			: `Propietario Demo ${index + 1}`;
		const asset = await client.propertyAsset.create({
			data: {
				title: property.title,
				addressLine: property.addressLine,
				city: property.city,
				province: property.province,
				propertyType: property.propertyType,
				totalAreaSqm: property.totalAreaSqm ?? null,
				coveredAreaSqm: property.coveredAreaSqm ?? null,
				rooms: property.rooms ?? null,
				bedrooms: property.bedrooms ?? null,
				bathrooms: property.bathrooms ?? null,
				garages: property.garages ?? null,
				ageYears: property.ageYears ?? null,
				orientation: property.orientation ?? null,
				ownerName,
				ownerEmail,
				createdByUserId: manager.id,
				createdAt: daysAgo(40 - (index % 12)),
			},
		});

		const owner = await client.propertyAssetOwner.create({
			data: {
				propertyAssetId: asset.id,
				ownerEmail,
				ownerFirstName: isDemoOwnerProperty
					? demoOwner.firstName
					: "Propietario",
				ownerLastName: isDemoOwnerProperty
					? demoOwner.lastName
					: `Demo ${index + 1}`,
				userId: isDemoOwnerProperty ? demoOwner.id : undefined,
				isPrimary: true,
				accessStatus: isDemoOwnerProperty
					? PropertyAssetOwnerAccessStatus.ACTIVE
					: PropertyAssetOwnerAccessStatus.INVITED,
				createdAt: daysAgo(35 - (index % 10)),
			},
		});

		const engagement = await client.propertyEngagement.create({
			data: {
				tenantId: tenant.id,
				propertyAssetId: asset.id,
				operationType: property.operationType,
				status: property.status,
				publishedPriceCents: moneyToCents(property.price),
				currency: property.currency,
				createdByUserId: manager.id,
				createdAt: daysAgo(38 - (index % 10)),
				agents: {
					create: {
						tenantId: tenant.id,
						agentUserId: seller.id,
						assignedByUserId: manager.id,
						assignedAt: daysAgo(34 - (index % 8)),
					},
				},
			},
		});

		createdProperties.push({
			fixture: property,
			asset,
			engagement,
			owner,
			seller,
		});
	}

	return createdProperties;
}

async function createDemoPropertyImages(client, tenant, properties) {
	const images = [];

	for (const [propertyIndex, property] of properties.entries()) {
		const imageUrls = DEMO_PROPERTY_IMAGE_URLS[propertyIndex] ?? [];

		for (const [imageIndex, imageUrl] of imageUrls.entries()) {
			try {
				const downloadedImage = await downloadDemoImage(imageUrl);
				const imageId = randomUUID();
				const extension = getExtensionForMimeType(downloadedImage.mimeType);
				const originalFilename = `demo-property-${propertyIndex + 1}-${
					imageIndex + 1
				}${extension}`;
				const storageKey = [
					PROPERTY_IMAGES_STORAGE_PREFIX,
					tenant.id,
					property.asset.id,
					`${imageId}${extension}`,
				].join("/");

				await writeDemoImageFile(storageKey, downloadedImage.buffer);
				images.push(
					await client.propertyAssetImage.create({
						data: {
							id: imageId,
							propertyAssetId: property.asset.id,
							uploadedByUserId: tenant.manager.id,
							storageKey,
							originalFilename,
							mimeType: downloadedImage.mimeType,
							sizeBytes: downloadedImage.buffer.byteLength,
							isPrimary: imageIndex === 0,
							createdAt: daysAgo(Math.max(1, propertyIndex % 12)),
						},
					}),
				);
			} catch (error) {
				console.warn(
					`Skipping demo image for property ${propertyIndex + 1}: ${getErrorMessage(
						error,
					)}`,
				);
			}
		}
	}

	return images;
}

async function downloadDemoImage(imageUrl) {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(),
		DEMO_IMAGE_DOWNLOAD_TIMEOUT_MS,
	);

	try {
		const response = await fetch(imageUrl, { signal: controller.signal });

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const mimeType = getImageMimeType(
			imageUrl,
			response.headers.get("content-type"),
		);

		if (!ALLOWED_PROPERTY_IMAGE_MIME_TYPES.has(mimeType)) {
			throw new Error(`Unsupported image type ${mimeType}`);
		}

		const contentLength = Number(response.headers.get("content-length") ?? 0);

		if (contentLength > DEMO_IMAGE_MAX_BYTES) {
			throw new Error("Image is larger than 5 MB");
		}

		const buffer = await readBoundedResponseBuffer(response);

		return { buffer, mimeType };
	} finally {
		clearTimeout(timeoutId);
	}
}

async function readBoundedResponseBuffer(response) {
	if (!response.body) {
		throw new Error("Image response body is empty");
	}

	const chunks = [];
	let totalBytes = 0;

	for await (const chunk of response.body) {
		const bufferChunk = Buffer.from(chunk);
		totalBytes += bufferChunk.byteLength;

		if (totalBytes > DEMO_IMAGE_MAX_BYTES) {
			throw new Error("Image is larger than 5 MB");
		}

		chunks.push(bufferChunk);
	}

	return Buffer.concat(chunks, totalBytes);
}

async function writeDemoImageFile(storageKey, buffer) {
	const absolutePath = join(getUploadsRoot(), storageKey);
	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, buffer);
}

async function removeDemoImageFiles(tenantId) {
	await rm(join(getUploadsRoot(), PROPERTY_IMAGES_STORAGE_PREFIX, tenantId), {
		force: true,
		recursive: true,
	});
}

async function removeDemoDocumentFiles(client, tenantId) {
	if (!isLocalDocumentStorageConfigured()) {
		return;
	}

	const versions = await client.documentVersion.findMany({
		where: { document: { documentRequest: { tenantId } } },
		select: { storageKey: true },
	});

	await Promise.all(
		versions.flatMap((version) => {
			const absolutePath = resolveDocumentStoragePath(version.storageKey);
			return [
				rm(absolutePath, { force: true }),
				rm(`${absolutePath}.metadata.json`, { force: true }),
			];
		}),
	);

	await rm(join(getDocumentStorageRoot(), DOCUMENT_STORAGE_PREFIX, tenantId), {
		force: true,
		recursive: true,
	});
}

function getUploadsRoot() {
	if (process.env.PROPERTY_IMAGES_UPLOADS_ROOT) {
		return resolve(process.env.PROPERTY_IMAGES_UPLOADS_ROOT);
	}

	return join(apiRoot, "uploads");
}

function getDocumentStorageRoot() {
	return resolve(
		process.env.DOCUMENT_STORAGE_LOCAL_ROOT ??
		join(process.cwd(), ".document-storage"),
	);
}

function resolveDocumentStoragePath(storageKey) {
	const root = getDocumentStorageRoot();
	const absolutePath = resolve(root, storageKey);

	if (absolutePath !== root && !absolutePath.startsWith(`${root}/`)) {
		throw new Error(`Refusing to write document fixture outside storage root: ${storageKey}`);
	}

	return absolutePath;
}

function isLocalDocumentStorageConfigured() {
	return (
		process.env.DOCUMENT_STORAGE_DRIVER === "local" ||
		Boolean(process.env.DOCUMENT_STORAGE_LOCAL_ROOT)
	);
}

function getImageMimeType(imageUrl, contentType) {
	const mimeType = contentType?.split(";")[0]?.trim().toLowerCase();

	if (mimeType) {
		return mimeType;
	}

	const pathname = new URL(imageUrl).pathname.toLowerCase();

	if (pathname.endsWith(".png")) {
		return "image/png";
	}

	if (pathname.endsWith(".webp")) {
		return "image/webp";
	}

	return "image/jpeg";
}

function getExtensionForMimeType(mimeType) {
	const extensionsByMimeType = {
		"image/jpeg": ".jpg",
		"image/png": ".png",
		"image/webp": ".webp",
	};

	return extensionsByMimeType[mimeType] ?? ".bin";
}

function getErrorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}

async function createDemoMovements(client, tenant, users, properties) {
	const sellers = [
		users.get("sofia.demo@viewpro.local"),
		users.get("martin.demo@viewpro.local"),
		users.get("lucia.demo@viewpro.local"),
	];
	const movementInputs = properties.flatMap((property, index) =>
		buildMovementsForProperty(property, index, sellers),
	);
	const movements = [];

	for (const movement of movementInputs) {
		movements.push(
			await client.movement.create({
				data: {
					tenantId: tenant.id,
					propertyEngagementId: movement.property.engagement.id,
					createdByUserId: movement.createdByUserId,
					type: movement.type,
					observation: movement.observation,
					nextStep: movement.nextStep ?? null,
					previousStatus: movement.previousStatus ?? null,
					newStatus: movement.newStatus ?? null,
					source: MovementSource.MANUAL,
					interestCount: movement.interestCount ?? null,
					visitCount: movement.visitCount ?? null,
					offerAmountCents: movement.offerAmountCents ?? null,
					interestLevel: movement.interestLevel ?? null,
					createdAt: movement.createdAt,
				},
			}),
		);
	}

	await createMovementAnalyticsEvents(client, tenant, movements);

	return movements;
}

function buildMovementsForProperty(property, index, sellers) {
	const seller = sellers[index % sellers.length];
	const collaborator = sellers[(index + 1) % sellers.length];
	const base = [
		{
			property,
			createdByUserId: seller.id,
			type: MovementType.GENERAL_UPDATE,
			observation: `Se actualizó la ficha comercial de ${property.fixture.title}.`,
			nextStep: "Revisar próximos pasos con el equipo comercial.",
			createdAt: daysAgo((index % 15) + 1),
		},
	];

	if (index % 2 === 0) {
		base.push({
			property,
			createdByUserId: collaborator.id,
			type: MovementType.INQUIRY,
			observation:
				"Ingresó una consulta calificada y se respondió con disponibilidad.",
			nextStep: "Coordinar visita o llamada de seguimiento.",
			interestCount: 1 + (index % 4),
			interestLevel:
				index % 4 === 0 ? InterestLevel.HIGH : InterestLevel.MEDIUM,
			createdAt: daysAgo(index % 7),
		});
	}

	if (index % 3 === 0) {
		base.push({
			property,
			createdByUserId: seller.id,
			type: MovementType.VISIT_SCHEDULED,
			observation:
				"Se coordinó una visita con un interesado para los próximos días.",
			nextStep: "Confirmar asistencia y preparar material de la propiedad.",
			visitCount: 1,
			createdAt: daysAgo((index % 5) + 1),
		});
	}

	if (index % 4 === 0) {
		base.push({
			property,
			createdByUserId: collaborator.id,
			type: MovementType.VISIT_COMPLETED,
			observation:
				"La visita se realizó y el interesado pidió información adicional.",
			nextStep: "Enviar documentación y condiciones actualizadas.",
			visitCount: 1,
			createdAt: daysAgo((index % 9) + 2),
		});
	}

	if (index % 5 === 0) {
		base.push({
			property,
			createdByUserId: seller.id,
			type: MovementType.OFFER_RECEIVED,
			observation:
				"Se recibió una oferta inicial para evaluar con el propietario.",
			nextStep: "Contactar al propietario para definir contraoferta.",
			offerAmountCents: moneyToCents(Math.round(property.fixture.price * 0.94)),
			interestLevel: InterestLevel.HIGH,
			createdAt: daysAgo((index % 6) + 1),
		});
	}

	if (index % 3 === 1) {
		base.push({
			property,
			createdByUserId: collaborator.id,
			type: MovementType.DOCUMENTATION_UPDATE,
			observation:
				"Se revisó la documentación disponible y faltan respaldos para completar la carpeta.",
			nextStep: "Pedir documentación pendiente al propietario.",
			createdAt: daysAgo((index % 11) + 3),
		});
	}

	if (index % 6 === 0) {
		base.push({
			property,
			createdByUserId: seller.id,
			type: MovementType.STATUS_CHANGE,
			observation:
				"La gestión avanzó de etapa comercial según actividad reciente.",
			previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
			newStatus: property.fixture.status,
			createdAt: daysAgo((index % 13) + 2),
		});
	}

	return base;
}

async function createMovementAnalyticsEvents(client, tenant, movements) {
	if (movements.length === 0) {
		return;
	}

	await client.analyticsEvent.createMany({
		data: movements.map((movement) => ({
			tenantId: tenant.id,
			actorUserId: movement.createdByUserId,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.MOVEMENT_CREATED,
			propertyEngagementId: movement.propertyEngagementId,
			movementId: movement.id,
			occurredAt: movement.createdAt,
		})),
	});
}

async function createDemoDocumentRequests(client, tenant, users, properties) {
	const requesters = [
		users.get("demo@viewpro.local"),
		users.get("sofia.demo@viewpro.local"),
		users.get("martin.demo@viewpro.local"),
	];
	const documentRequests = [];

	for (const [index, property] of properties.entries()) {
		if (index % 2 !== 0) {
			continue;
		}

		const requestCount = index % 4 === 0 ? 2 : 1;

		for (let requestIndex = 0; requestIndex < requestCount; requestIndex += 1) {
			const title =
				DOCUMENT_TITLES[(index + requestIndex) % DOCUMENT_TITLES.length];
			const requester = requesters[(index + requestIndex) % requesters.length];
			const request = await client.documentRequest.create({
				data: {
					tenantId: tenant.id,
					propertyEngagementId: property.engagement.id,
					propertyAssetOwnerId: property.owner.id,
					ownerUserId: property.owner.userId ?? null,
					requestedByUserId: requester.id,
					title,
					description: `Solicitud demo para completar carpeta: ${title}.`,
					status: DocumentRequestStatus.PENDING,
					createdAt: daysAgo((index + requestIndex) % 18),
				},
			});

			documentRequests.push(request);
		}
	}

	const reviewStateRequests = await createDemoDocumentReviewStates(
		client,
		tenant,
		users,
		properties,
	);
	documentRequests.push(...reviewStateRequests);

	await createDocumentAnalyticsEvents(client, tenant, documentRequests);
	await createDocumentReviewAnalyticsEvents(
		client,
		tenant,
		reviewStateRequests,
	);

	return documentRequests;
}

async function createDemoDocumentReviewStates(
	client,
	tenant,
	users,
	properties,
) {
	const property = properties[0];
	const owner = users.get(DEMO_OWNER_EMAIL);
	const requester = users.get("sofia.demo@viewpro.local");
	const reviewer = users.get("demo@viewpro.local");

	if (!property || !owner || !requester || !reviewer) {
		return [];
	}

	const fixtures = [
		{
			title: "Escritura firmada",
			description: "Documento demo cargado por el propietario para revisión.",
			status: DocumentRequestStatus.SUBMITTED,
			versionStatus: DocumentVersionStatus.UPLOADED,
			originalFilename: "escritura-firmada-demo.pdf",
			body: Buffer.from(
				"%PDF-1.4\n% ViewPro demo submitted document\n",
				"utf8",
			),
			createdAt: daysAgo(7),
			uploadedAt: daysAgo(6),
		},
		{
			title: "DNI del propietario observado",
			description:
				"Documento demo observado para probar reenvío desde portal propietario.",
			status: DocumentRequestStatus.REJECTED,
			versionStatus: DocumentVersionStatus.REJECTED,
			originalFilename: "dni-propietario-observado-demo.pdf",
			body: Buffer.from("%PDF-1.4\n% ViewPro demo rejected document\n", "utf8"),
			rejectionReason:
				"La imagen no permite leer el dorso del DNI. Subí una copia más nítida.",
			createdAt: daysAgo(10),
			uploadedAt: daysAgo(9),
			reviewedAt: daysAgo(8),
		},
	];

	const requests = [];

	for (const fixture of fixtures) {
		const request = await client.documentRequest.create({
			data: {
				tenantId: tenant.id,
				propertyEngagementId: property.engagement.id,
				propertyAssetOwnerId: property.owner.id,
				ownerUserId: owner.id,
				requestedByUserId: requester.id,
				title: fixture.title,
				description: fixture.description,
				status: fixture.status,
				reviewedByUserId:
					fixture.status === DocumentRequestStatus.REJECTED
						? reviewer.id
						: null,
				reviewedAt: fixture.reviewedAt ?? null,
				rejectionReason: fixture.rejectionReason ?? null,
				createdAt: fixture.createdAt,
				updatedAt: fixture.reviewedAt ?? fixture.uploadedAt,
			},
		});
		const storageKey = [
			DOCUMENT_STORAGE_PREFIX,
			tenant.id,
			request.id,
			fixture.originalFilename,
		].join("/");
		const document = await client.document.create({
			data: { documentRequestId: request.id },
		});
		const version = await client.documentVersion.create({
			data: {
				documentId: document.id,
				uploadedByUserId: owner.id,
				storageKey,
				originalFilename: fixture.originalFilename,
				mimeType: "application/pdf",
				sizeBytes: fixture.body.byteLength,
				checksum: `demo:${fixture.status.toLowerCase()}:${request.id}`,
				status: fixture.versionStatus,
				createdAt: fixture.uploadedAt,
			},
		});
		await client.document.update({
			where: { id: document.id },
			data: { currentVersionId: version.id },
		});
		await writeDemoDocumentFileIfEnabled(storageKey, fixture.body, {
			mimeType: "application/pdf",
			sizeBytes: fixture.body.byteLength,
		});
		requests.push({
			...request,
			demoUploadedAt: fixture.uploadedAt,
			demoReviewedAt: fixture.reviewedAt ?? null,
		});
	}

	return requests;
}

async function createDocumentAnalyticsEvents(client, tenant, documentRequests) {
	if (documentRequests.length === 0) {
		return;
	}

	await client.analyticsEvent.createMany({
		data: documentRequests.map((request) => ({
			tenantId: tenant.id,
			actorUserId: request.requestedByUserId,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.DOCUMENT_REQUESTED,
			propertyEngagementId: request.propertyEngagementId,
			documentRequestId: request.id,
			occurredAt: request.createdAt,
		})),
	});
}

async function createDocumentReviewAnalyticsEvents(
	client,
	tenant,
	documentRequests,
) {
	if (documentRequests.length === 0) {
		return;
	}

	const events = documentRequests.flatMap((request) => {
		const uploadedEvent = {
			tenantId: tenant.id,
			actorUserId: request.ownerUserId,
			actorType: AnalyticsActorType.OWNER,
			eventName: AnalyticsEventName.DOCUMENT_UPLOADED,
			propertyEngagementId: request.propertyEngagementId,
			documentRequestId: request.id,
			occurredAt: request.demoUploadedAt ?? request.updatedAt,
		};

		if (request.status !== DocumentRequestStatus.REJECTED) {
			return [uploadedEvent];
		}

		return [
			uploadedEvent,
			{
				tenantId: tenant.id,
				actorUserId: request.reviewedByUserId,
				actorType: AnalyticsActorType.INTERNAL_USER,
				eventName: AnalyticsEventName.DOCUMENT_REJECTED,
				propertyEngagementId: request.propertyEngagementId,
				documentRequestId: request.id,
				occurredAt: request.demoReviewedAt ?? request.reviewedAt ?? request.updatedAt,
			},
		];
	});

	await client.analyticsEvent.createMany({ data: events });
}

async function writeDemoDocumentFileIfEnabled(storageKey, buffer, metadata) {
	if (!isLocalDocumentStorageConfigured()) {
		return;
	}

	const absolutePath = resolveDocumentStoragePath(storageKey);
	await mkdir(dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, buffer);
	await writeFile(`${absolutePath}.metadata.json`, JSON.stringify(metadata));
}

function assertSafeEnvironment() {
	if (process.env.NODE_ENV === "production") {
		throw new Error("Refusing to run demo seed with NODE_ENV=production.");
	}

	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required to run the demo seed.");
	}

	if (process.env.VIEWPRO_ALLOW_DEMO_SEED === "true") {
		return;
	}

	const normalizedUrl = databaseUrl.toLowerCase();
	const looksSafe = [
		"localhost",
		"127.0.0.1",
		"viewpro_dev",
		"viewpro_test",
	].some((signal) => normalizedUrl.includes(signal));

	if (!looksSafe) {
		throw new Error(
			"Refusing to run demo seed against a database URL that does not look local/dev/test. Set VIEWPRO_ALLOW_DEMO_SEED=true only when you are certain this is safe.",
		);
	}
}

function loadEnvFile(filePath) {
	if (!existsSync(filePath)) {
		return;
	}

	const file = readFileSync(filePath, "utf8");

	for (const line of file.split(/\r?\n/)) {
		const trimmedLine = line.trim();

		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf("=");

		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const value = unquoteEnvValue(trimmedLine.slice(separatorIndex + 1).trim());

		if (key && process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

function unquoteEnvValue(value) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}

function buildDefaultDemoPassword() {
	return ["viewpro", "demo", "local"].join("-");
}

function daysAgo(days) {
	const date = new Date();
	date.setDate(date.getDate() - days);
	return date;
}

function moneyToCents(amount) {
	return Math.round(amount * 100);
}

function printSummary(result) {
	console.log(`Seeded ${result.tenant.name}`);
	console.log("Login: demo@viewpro.local");
	console.log(`Password: ${DEMO_PASSWORD}`);
	console.log(`Properties: ${result.propertiesCount}`);
	console.log(`Images: ${result.imagesCount}`);
	console.log(`Movements: ${result.movementsCount}`);
	console.log(`Document requests: ${result.documentRequestsCount}`);
}

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FileText, Send, Download, BarChart2, Table as TableIcon, FileSpreadsheet, FileDown, ChevronDown, ChevronUp } from "lucide-react";
import type { AcademicPaper, TopicInfo, SectorReport } from "@/lib/types/research";
import jsPDF from "jspdf";

interface GeneratedDataReviewProps {
    papers: AcademicPaper[];
    topics: TopicInfo[];
    report: SectorReport;
    elapsedTime: string;
    onSendToUpload: () => void;
}

export function GeneratedDataReview({ papers, topics, report, elapsedTime, onSendToUpload }: GeneratedDataReviewProps) {
    const [activeSection, setActiveSection] = useState<"report" | "topics" | "papers">("report");

    const downloadCSV = (filename: string, content: string) => {
        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadTopics = () => {
        // Generate simple CSV for topics
        const headers = ["ID", "Count", "Name", "Keywords", "Rarity"];
        const rows = topics.filter(t => t.topicNumber >= 0).map(t => [
            t.topicNumber,
            t.count,
            `"${t.name.replace(/"/g, '""')}"`,
            `"${t.representation.join(', ').replace(/"/g, '""')}"`,
            t.rarityLabel || "COMMON"
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        downloadCSV("generated_topics.csv", csvContent);
    };

    const handleDownloadPapers = () => {
        // Generate simple CSV for papers
        const headers = ["ID", "Title", "Year", "Authors", "DOI", "TopicID"];
        const rows = papers.map(p => [
            p.id,
            `"${p.title.replace(/"/g, '""')}"`,
            p.year,
            `"${p.authors.join(', ').replace(/"/g, '""')}"`,
            p.doi || "",
            p.topicNumber !== undefined ? p.topicNumber : -1
        ]);
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        downloadCSV("generated_papers.csv", csvContent);
    };

    const handleDownloadReport = () => {
        // Basic PDF export for the report
        try {
            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
            });
            // (Implementation kept simple for now, can be expanded if needed)
            doc.setFontSize(16);
            doc.text(report.sector_definition.name, 20, 20);
            doc.setFontSize(10);
            const splitText = doc.splitTextToSize(report.sector_definition.description, 170);
            doc.text(splitText, 20, 30);
            doc.save(`${report.sector_definition.name.toLowerCase().replace(/\s+/g, '_')}_report.pdf`);
        } catch (e) {
            console.error("PDF generation failed:", e);
            alert("Failed to generate PDF. Check console for details.");
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Data Generation Complete!</h2>
                    <p className="text-muted-foreground">Generated in {elapsedTime}. Please review the data below.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="secondary" onClick={() => {
                        handleDownloadReport();
                        handleDownloadTopics();
                        handleDownloadPapers();
                    }}>
                        <Download className="mr-2 h-4 w-4" />
                        Download All
                    </Button>
                    <Button variant="primary" onClick={onSendToUpload}>
                        <Send className="mr-2 h-4 w-4" />
                        Send to Upload Data
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-b pb-4">
                <button
                    onClick={() => setActiveSection("report")}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSection === "report" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
                >
                    <FileText className={`h-8 w-8 ${activeSection === "report" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-medium">Sector Report</span>
                </button>
                <button
                    onClick={() => setActiveSection("topics")}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSection === "topics" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
                >
                    <BarChart2 className={`h-8 w-8 ${activeSection === "topics" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-medium">Identified Topics</span>
                </button>
                <button
                    onClick={() => setActiveSection("papers")}
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSection === "papers" ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"}`}
                >
                    <TableIcon className={`h-8 w-8 ${activeSection === "papers" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-medium">Collected Papers</span>
                </button>
            </div>

            <div className="min-h-[500px]">
                {activeSection === "report" && (
                    <Card>
                        <CardHeader className="flex flex-row space-y-0 justify-between items-start">
                            <div>
                                <div>
                                    <h3 className="text-lg font-semibold m-0">{report.sector_definition.name}</h3>
                                    <p className="text-sm text-muted-foreground m-0">Comprehensive analytical report</p>
                                </div>              </div>
                            <Button variant="secondary" size="sm" onClick={handleDownloadReport}>
                                <FileDown className="mr-2 h-4 w-4" /> Export PDF
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-8 prose prose-sm max-w-none dark:prose-invert">
                            <section>
                                <h3>Sector Definition</h3>
                                <p>{report.sector_definition.description}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {report.sector_definition.nace_codes?.map(c => <Badge key={c} variant="muted">{c}</Badge>)}
                                    {report.sector_definition.naics_codes?.map(c => <Badge key={c} variant="muted">{c}</Badge>)}
                                </div>
                            </section>

                            <section>
                                <h3>Exogenous Forces</h3>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <h4 className="mt-0 text-foreground">Social</h4>
                                        <ul className="pl-4">
                                            {report.exogenous_forces?.social?.map((s, i) => <li key={i}><strong>{s.force}:</strong> {s.description}</li>) || <li>No data</li>}
                                        </ul>
                                    </div>
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <h4 className="mt-0 text-foreground">Technological</h4>
                                        <ul className="pl-4">
                                            {report.exogenous_forces?.technological?.map((s, i) => <li key={i}><strong>{s.force}:</strong> {s.description}</li>) || <li>No data</li>}
                                        </ul>
                                    </div>
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <h4 className="mt-0 text-foreground">Environmental</h4>
                                        <ul className="pl-4">
                                            {report.exogenous_forces?.environmental?.map((s, i) => <li key={i}><strong>{s.force}:</strong> {s.description}</li>) || <li>No data</li>}
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3>Technology Catalog</h3>
                                <div className="space-y-4">
                                    {report.technologies?.map((tech, i) => (
                                        <div key={i} className="border-l-4 border-primary pl-4 py-1">
                                            <h4 className="m-0 text-primary">{tech.name}</h4>
                                            <p className="m-0 text-muted-foreground">{tech.description}</p>
                                            <p className="m-0 text-xs">Adoption: {tech.adoption_level}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section>
                                <h3>Labor Market Summary</h3>
                                <p><strong>Predicted Growth Rate:</strong> {report.labor_market?.growth_projection ? (report.labor_market.growth_projection.projected_growth_rate * 100).toFixed(1) + "%" : "Data unavailable"}</p>
                                <p><strong>Automation Risk:</strong> {report.labor_market?.automation_risk ? (report.labor_market.automation_risk.automation_probability * 100).toFixed(0) + "% probability (" + report.labor_market.automation_risk.time_horizon + ")" : "Data unavailable"}</p>
                            </section>

                            <section>
                                <h3>Future Scenarios</h3>
                                <div className="space-y-4">
                                    {report.scenarios?.map((scen, i) => (
                                        <div key={i} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg">
                                            <h4 className="m-0 flex justify-between">
                                                <span>{scen.name}</span>
                                            </h4>
                                            <p className="mb-2 text-sm">{scen.description}</p>
                                            <div className="text-xs space-y-1">
                                                <p><strong>Key Technologies:</strong> {scen.key_technologies?.join(", ")}</p>
                                                <p><strong>Required Skills:</strong> {scen.required_skills?.join(", ")}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </CardContent>
                    </Card>
                )}

                {activeSection === "topics" && (
                    <Card>
                        <CardHeader className="flex flex-row space-y-0 justify-between items-start">
                            <div>
                                <div>
                                    <h3 className="text-lg font-semibold m-0">Identified Topics</h3>
                                    <p className="text-sm text-muted-foreground m-0">{topics.filter(t => t.topicNumber >= 0).length} core topics extracted from {papers.length} papers</p>
                                </div>              </div>
                            <Button variant="secondary" size="sm" onClick={handleDownloadTopics}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="h-10 px-4 text-left font-medium">#</th>
                                            <th className="h-10 px-4 text-left font-medium">Name</th>
                                            <th className="h-10 px-4 text-left font-medium text-right">Papers</th>
                                            <th className="h-10 px-4 text-left font-medium">Keywords</th>
                                            <th className="h-10 px-4 text-left font-medium">Rarity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topics.filter(t => t.topicNumber >= 0).map((topic, i) => (
                                            <tr key={topic.topicNumber} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                                                <td className="p-4 align-top font-medium">{topic.topicNumber}</td>
                                                <td className="p-4 align-top font-semibold text-primary">{topic.name}</td>
                                                <td className="p-4 align-top text-right">{topic.count}</td>
                                                <td className="p-4 align-top text-muted-foreground">{topic.representation.join(", ")}</td>
                                                <td className="p-4 align-top">
                                                    <Badge variant={topic.rarityLabel === "RARE" ? "primary" : "muted"}>
                                                        {topic.rarityLabel || "COMMON"}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeSection === "papers" && (
                    <Card>
                        <CardHeader className="flex flex-row space-y-0 justify-between items-start">
                            <div>
                                <div>
                                    <h3 className="text-lg font-semibold m-0">Collected Papers</h3>
                                    <p className="text-sm text-muted-foreground m-0">Detailed list of {papers.length} academic sources</p>
                                </div>              </div>
                            <Button variant="secondary" size="sm" onClick={handleDownloadPapers}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-hidden max-h-[600px] overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="h-10 px-4 text-left font-medium w-1/2">Title & Authors</th>
                                            <th className="h-10 px-4 text-left font-medium">Year</th>
                                            <th className="h-10 px-4 text-left font-medium">Venue</th>
                                            <th className="h-10 px-4 text-left font-medium">Topic ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {papers.map((paper, i) => (
                                            <tr key={paper.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-background" : "bg-muted/10 hover:bg-muted/30"} transition-colors`}>
                                                <td className="p-4 align-top">
                                                    <div className="font-medium text-primary mb-1">
                                                        {paper.url ? (
                                                            <a href={paper.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{paper.title}</a>
                                                        ) : (
                                                            paper.title
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{paper.authors.join(", ")}</div>
                                                </td>
                                                <td className="p-4 align-top">{paper.year}</td>
                                                <td className="p-4 align-top text-muted-foreground truncate max-w-[150px]" title={paper.venue}>{paper.venue || "N/A"}</td>
                                                <td className="p-4 align-top">
                                                    {paper.topicNumber !== undefined && paper.topicNumber >= 0 ? (
                                                        <Badge variant="muted">Topic {paper.topicNumber}</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">Outlier</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
